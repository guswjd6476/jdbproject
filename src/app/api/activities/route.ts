import { pool } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import { verifyToken } from '@/app/lib/auth';
import type { JwtPayload } from 'jsonwebtoken';
import { getParameterizedQueryConditionForUser } from '@/app/lib/authUtils';

type Role = '노방' | '온라인' | '만남' | '교사' | '잎사귀';
const allowedRoles: Role[] = ['노방', '온라인', '만남', '교사', '잎사귀'];

type ActivityRowPayload = {
    날짜?: string | null; // YYYY-MM-DD or null
    지역: string;
    팀: string;
    이름: string;
    활동: Role;
    memo?: string | null;

    // 동명이인 선택 이후 재시도용(프론트에서 넣어줄 수 있음)
    member_id?: string | null;

    // UI index
    originalIndex?: number;
};

function parseISODateOnly(input?: string | null): string | null {
    if (!input) return null;
    const s = input.trim();
    if (!s) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    return s;
}

async function getOrInsertMemberUniqueId(
    client: PoolClient,
    지역: string,
    팀: string,
    이름: string
): Promise<string | null | any[]> {
    if (!지역?.trim() || !이름?.trim()) return null;

    const trimmedRegion = 지역.trim();
    const trimmedTeam = (팀 ?? '').trim();
    const trimmedName = 이름.trim();

    const specialRegions = ['타지파', '타부서', '지교회'];
    const isSpecialRegion = specialRegions.includes(trimmedRegion);

    let findQuery: string;
    let findValues: string[];

    if (isSpecialRegion) {
        findQuery = `
      SELECT 고유번호, 이름, 지역, 구역 as 팀
      FROM members
      WHERE 지역 = $1 AND 이름 = $2
    `;
        findValues = [trimmedRegion, trimmedName];
    } else {
        if (!trimmedTeam) return null;
        const prefix = trimmedTeam.charAt(0);
        findQuery = `
      SELECT 고유번호, 이름, 지역, 구역 as 팀
      FROM members
      WHERE 지역 = $1 AND 구역 LIKE $2 AND 이름 = $3
    `;
        findValues = [trimmedRegion, prefix + '%', trimmedName];
    }

    const res = await client.query(findQuery, findValues);

    if (res.rows.length > 1) return res.rows;
    if (res.rows.length === 1) return res.rows[0].고유번호;

    if (isSpecialRegion) {
        const insertQuery = `
      INSERT INTO members (고유번호, 지역, 이름, 구역)
      VALUES (gen_random_uuid(), $1, $2, $3)
      RETURNING 고유번호
    `;
        const insertValues = [trimmedRegion, trimmedName, trimmedTeam];
        const insertRes = await client.query(insertQuery, insertValues);
        return insertRes.rows[0].고유번호;
    }

    return null;
}

// ========================== GET (로그/집계) ==========================
export async function GET(request: NextRequest) {
    const client = await pool.connect();
    try {
        const token = request.cookies.get('token')?.value;
        let userEmail = '';
        if (token) {
            try {
                const user = verifyToken(token);
                if (typeof user === 'object' && user !== null && 'email' in user) {
                    userEmail = (user as JwtPayload).email ?? '';
                }
            } catch {
                userEmail = '';
            }
        }

        const sp = request.nextUrl.searchParams;
        const mode = (sp.get('mode') ?? 'summary').trim() as 'log' | 'summary';

        const from = parseISODateOnly(sp.get('from'));
        const to = parseISODateOnly(sp.get('to'));
        const q = (sp.get('q') ?? '').trim();
        const role = (sp.get('role') ?? '').trim();

        const values: any[] = [];
        const where: string[] = [];

        if (from) {
            values.push(from);
            where.push(`a.activity_date >= $${values.length}`);
        }
        if (to) {
            values.push(to);
            where.push(`a.activity_date <= $${values.length}`);
        }

        if (role) {
            if (!allowedRoles.includes(role as Role)) return NextResponse.json([]);
            values.push(role);
            where.push(`a.role = $${values.length}`);
        }

        if (q) {
            values.push(`%${q}%`);
            where.push(
                `(m.이름 ILIKE $${values.length} OR m.지역 ILIKE $${values.length} OR m.구역 ILIKE $${values.length})`
            );
        }

        const permissionParam = getParameterizedQueryConditionForUser(userEmail, values.length + 1);
        if (permissionParam.condition) {
            where.push(permissionParam.condition);
            values.push(...permissionParam.values);
        }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        if (mode === 'summary') {
            const sql = `
        SELECT
          m.지역,
          m.구역 AS 팀,
          m.이름,
          a.role,
          COUNT(*)::int AS 횟수,
          MIN(a.activity_date) AS 시작일,
          MAX(a.activity_date) AS 마지막일
        FROM member_activities a
        JOIN members m ON a.member_id = m.고유번호
        ${whereSql}
        GROUP BY m.지역, m.구역, m.이름, a.role
        ORDER BY m.지역, m.구역, m.이름, a.role
      `;
            const res = await client.query(sql, values);
            return NextResponse.json(res.rows);
        }

        const sql = `
      SELECT
        a.id,
        a.activity_date AS 날짜,
        a.role AS 활동,
        a.memo,
        m.지역,
        m.구역 AS 팀,
        m.이름,
        a.member_id AS 고유번호,
        a.created_at
      FROM member_activities a
      JOIN members m ON a.member_id = m.고유번호
      ${whereSql}
      ORDER BY a.activity_date DESC, a.id DESC
      LIMIT 500
    `;
        const res = await client.query(sql, values);
        return NextResponse.json(res.rows);
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? '조회 실패' }, { status: 500 });
    } finally {
        client.release();
    }
}

// ========================== POST (bulk 저장) ==========================
export async function POST(request: NextRequest) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const body = await request.json();
        const data: ActivityRowPayload[] = Array.isArray(body?.data) ? body.data : [];

        if (data.length === 0) {
            await client.query('ROLLBACK');
            return NextResponse.json({ success: false, message: '저장할 데이터가 없습니다.' }, { status: 400 });
        }

        for (const row of data) {
            const role = row.활동;
            if (!allowedRoles.includes(role)) {
                throw new Error(`활동 항목 오류: ${role}`);
            }

            const region = (row.지역 ?? '').trim();
            const team = (row.팀 ?? '').trim();
            const name = (row.이름 ?? '').trim();

            if (!region || !name) throw new Error('지역/이름 누락');

            const dateOnly = parseISODateOnly(row.날짜 ?? null);
            if (row.날짜 && !dateOnly) throw new Error(`날짜 형식 오류: ${row.날짜}`);

            // 1) 프론트에서 member_id를 이미 선택했으면 그걸 우선 사용
            let memberId: string | null = (row.member_id ?? '').trim() || null;

            // 2) 없으면 지역/팀/이름으로 매핑
            if (!memberId) {
                const result = await getOrInsertMemberUniqueId(client, region, team, name);

                if (Array.isArray(result)) {
                    await client.query('ROLLBACK');
                    return NextResponse.json(
                        {
                            success: false,
                            code: 'NEEDS_SELECTION',
                            context: {
                                rowIndex: row.originalIndex ?? 0,
                                field: '멤버',
                                choices: result,
                            },
                        },
                        { status: 409 }
                    );
                }

                memberId = result;
            }

            if (!memberId) {
                throw new Error(`멤버를 찾을 수 없습니다: ${region}/${team}/${name}`);
            }

            const memo = row.memo ?? null;

            // 날짜 없으면 DEFAULT CURRENT_DATE로 저장
            if (dateOnly) {
                await client.query(
                    `
          INSERT INTO member_activities (activity_date, member_id, role, memo)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (activity_date, member_id, role)
          DO UPDATE SET memo = COALESCE(EXCLUDED.memo, member_activities.memo)
          `,
                    [dateOnly, memberId, role, memo]
                );
            } else {
                await client.query(
                    `
          INSERT INTO member_activities (member_id, role, memo)
          VALUES ($1, $2, $3)
          ON CONFLICT (activity_date, member_id, role)
          DO UPDATE SET memo = COALESCE(EXCLUDED.memo, member_activities.memo)
          `,
                    [memberId, role, memo]
                );
            }
        }

        await client.query('COMMIT');
        return NextResponse.json({ success: true, message: '저장 성공' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        return NextResponse.json({ success: false, message: err.message ?? '저장 실패' }, { status: 500 });
    } finally {
        client.release();
    }
}
