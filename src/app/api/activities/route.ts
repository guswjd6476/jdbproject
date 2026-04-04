import { pool } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import { verifyToken } from '@/app/lib/auth';
import type { JwtPayload } from 'jsonwebtoken';
import { getParameterizedQueryConditionForUser } from '@/app/lib/authUtils';

type Role = '노방' | '온라인' | '만남' | '교사' | '잎사귀';
const allowedRoles: Role[] = ['노방', '온라인', '만남', '교사', '잎사귀'];

type Mode = 'log' | 'summary';
type GroupBy = 'region' | 'team' | 'region_team' | 'member' | 'role';

const EXCLUDED_REGIONS = ['지교회', '타부서', '타지파'];

type ActivityRowPayload = {
    날짜?: string | null;
    지역: string;
    팀: string;
    이름: string;
    활동: Role;
    memo?: string | null;
    member_id?: string | null;
    originalIndex?: number;
};

function parseISODateOnly(input?: string | null): string | null {
    if (!input) return null;
    const s = input.trim();
    if (!s) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    return s;
}

function formatDateLocal(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function isValidMode(v: string): v is Mode {
    return v === 'log' || v === 'summary';
}

function isValidGroupBy(v: string): v is GroupBy {
    return v === 'region' || v === 'team' || v === 'region_team' || v === 'member' || v === 'role';
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
            SELECT 고유번호, 이름, 지역, 구역 AS 팀
            FROM members
            WHERE 지역 = $1 AND 이름 = $2
        `;
        findValues = [trimmedRegion, trimmedName];
    } else {
        if (!trimmedTeam) return null;

        findQuery = `
            SELECT 고유번호, 이름, 지역, 구역 AS 팀
            FROM members
            WHERE 지역 = $1
              AND (
                    구역 = $2
                    OR 구역 LIKE $3
                  )
              AND 이름 = $4
        `;
        findValues = [trimmedRegion, trimmedTeam, `${trimmedTeam}-%`, trimmedName];
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

// ========================== GET ==========================
export async function GET(request: NextRequest) {
    const client = await pool.connect();

    try {
        const token = request.cookies.get('token')?.value;
        let userEmail = '';

        if (token) {
            try {
                const decoded = verifyToken(token);
                if (decoded && typeof decoded === 'object' && 'email' in decoded) {
                    userEmail = (decoded as JwtPayload).email ?? '';
                }
            } catch {
                userEmail = '';
            }
        }

        const sp = request.nextUrl.searchParams;

        const rawMode = (sp.get('mode') ?? 'log').trim();
        const rawGroupBy = (sp.get('groupBy') ?? 'region_team').trim();
        const isExport = sp.get('export') === '1';

        if (!isValidMode(rawMode)) {
            return NextResponse.json({ success: false, error: 'mode 값 오류' }, { status: 400 });
        }

        if (!isValidGroupBy(rawGroupBy)) {
            return NextResponse.json({ success: false, error: 'groupBy 값 오류' }, { status: 400 });
        }

        const mode: Mode = rawMode;
        const groupBy: GroupBy = rawGroupBy;

        const fromRaw = sp.get('from');
        const toRaw = sp.get('to');

        const from = parseISODateOnly(fromRaw);
        const to = parseISODateOnly(toRaw);

        if (fromRaw && !from) {
            return NextResponse.json({ success: false, error: 'from 날짜 형식 오류 (YYYY-MM-DD)' }, { status: 400 });
        }

        if (toRaw && !to) {
            return NextResponse.json({ success: false, error: 'to 날짜 형식 오류 (YYYY-MM-DD)' }, { status: 400 });
        }

        if (from && to && from > to) {
            return NextResponse.json(
                { success: false, error: 'from 날짜는 to 날짜보다 클 수 없습니다.' },
                { status: 400 }
            );
        }

        const q = (sp.get('q') ?? '').trim();
        const role = (sp.get('role') ?? '').trim();

        const page = Math.max(1, Number(sp.get('page') ?? '1'));
        const pageSizeRaw = Number(sp.get('pageSize') ?? '50');
        const safePageSizeRaw = Number.isFinite(pageSizeRaw) ? pageSizeRaw : 50;

        const pageSize = isExport ? 1000000 : Math.min(200, Math.max(1, safePageSizeRaw));

        const offset = (page - 1) * pageSize;

        const baseValues: any[] = [];
        const where: string[] = [];

        // 제외 지역
        baseValues.push(EXCLUDED_REGIONS);
        where.push(`COALESCE(m.지역, '') <> ALL($${baseValues.length})`);

        if (from) {
            baseValues.push(from);
            where.push(`a.activity_date >= $${baseValues.length}`);
        }

        if (to) {
            baseValues.push(to);
            where.push(`a.activity_date <= $${baseValues.length}`);
        }

        if (role) {
            if (!allowedRoles.includes(role as Role)) {
                return NextResponse.json({ success: false, error: 'role 값 오류' }, { status: 400 });
            }
            baseValues.push(role);
            where.push(`a.role = $${baseValues.length}`);
        }

        if (q) {
            baseValues.push(`%${q}%`);
            where.push(
                `(m.이름 ILIKE $${baseValues.length} OR m.지역 ILIKE $${baseValues.length} OR m.구역 ILIKE $${baseValues.length})`
            );
        }

        const permissionParam = getParameterizedQueryConditionForUser(userEmail, baseValues.length + 1);
        if (permissionParam?.condition) {
            where.push(permissionParam.condition);
            if (permissionParam.values?.length) {
                baseValues.push(...permissionParam.values);
            }
        }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        if (mode === 'summary') {
            const values = [...baseValues];

            let selectColumns = '';
            let groupSql = '';
            let orderSql = '';

            switch (groupBy) {
                case 'region':
                    selectColumns = `
                        COALESCE(m.지역, '') AS key,
                        COALESCE(m.지역, '') AS 지역
                    `;
                    groupSql = `COALESCE(m.지역, '')`;
                    orderSql = `COALESCE(m.지역, '') ASC`;
                    break;

                case 'team':
                    selectColumns = `
                        COALESCE(m.구역, '') AS key,
                        COALESCE(m.구역, '') AS 팀
                    `;
                    groupSql = `COALESCE(m.구역, '')`;
                    orderSql = `COALESCE(m.구역, '') ASC`;
                    break;

                case 'region_team':
                    selectColumns = `
                        COALESCE(m.지역, '') || ' / ' || COALESCE(NULLIF(m.구역, ''), '(팀없음)') AS key,
                        COALESCE(m.지역, '') AS 지역,
                        COALESCE(NULLIF(m.구역, ''), '(팀없음)') AS 팀
                    `;
                    groupSql = `
                        COALESCE(m.지역, ''),
                        COALESCE(NULLIF(m.구역, ''), '(팀없음)')
                    `;
                    orderSql = `
                        COALESCE(m.지역, '') ASC,
                        COALESCE(NULLIF(m.구역, ''), '(팀없음)') ASC
                    `;
                    break;

                case 'member':
                    selectColumns = `
                        a.member_id AS key,
                        COALESCE(m.이름, '') AS 이름,
                        COALESCE(m.지역, '') AS 지역,
                        COALESCE(NULLIF(m.구역, ''), '(팀없음)') AS 팀
                    `;
                    groupSql = `
                        a.member_id,
                        COALESCE(m.이름, ''),
                        COALESCE(m.지역, ''),
                        COALESCE(NULLIF(m.구역, ''), '(팀없음)')
                    `;
                    orderSql = `
                        COUNT(*) DESC,
                        COALESCE(m.지역, '') ASC,
                        COALESCE(NULLIF(m.구역, ''), '(팀없음)') ASC,
                        COALESCE(m.이름, '') ASC
                    `;
                    break;

                case 'role':
                    selectColumns = `
                        COALESCE(a.role, '') AS key,
                        COALESCE(a.role, '') AS 활동
                    `;
                    groupSql = `COALESCE(a.role, '')`;
                    orderSql = `COALESCE(a.role, '') ASC`;
                    break;
            }

            let dailyAvgSql = `NULL::numeric AS daily_avg`;

            if (from && to) {
                values.push(from);
                const fromIdx = values.length;
                values.push(to);
                const toIdx = values.length;

                dailyAvgSql = `
                    ROUND(
                        COUNT(*)::numeric / GREATEST(1, (($${toIdx}::date - $${fromIdx}::date) + 1)),
                        2
                    ) AS daily_avg
                `;
            }

            const sql = `
                SELECT
                    ${selectColumns},
                    COUNT(*)::int AS cnt,
                    ${dailyAvgSql},
                    TO_CHAR(MIN(a.activity_date)::date, 'YYYY-MM-DD') AS start_date,
                    TO_CHAR(MAX(a.activity_date)::date, 'YYYY-MM-DD') AS last_date
                FROM member_activities a
                JOIN members m ON a.member_id = m.고유번호
                ${whereSql}
                GROUP BY ${groupSql}
                ORDER BY ${orderSql}
            `;

            const res = await client.query(sql, values);

            return NextResponse.json({
                success: true,
                rows: res.rows,
            });
        }

        const countSql = `
            SELECT COUNT(*)::int AS total
            FROM member_activities a
            JOIN members m ON a.member_id = m.고유번호
            ${whereSql}
        `;

        const listSql = `
            SELECT
                a.id,
                TO_CHAR(a.activity_date::date, 'YYYY-MM-DD') AS 날짜,
                a.role AS 활동,
                a.memo,
                m.지역,
                m.구역 AS 팀,
                m.이름,
                a.member_id AS 고유번호,
                TO_CHAR(a.created_at, 'YYYY-MM-DD HH24:MI') AS created_at
            FROM member_activities a
            JOIN members m ON a.member_id = m.고유번호
            ${whereSql}
            ORDER BY a.activity_date DESC NULLS LAST, a.id DESC
            ${isExport ? '' : `LIMIT $${baseValues.length + 1} OFFSET $${baseValues.length + 2}`}
        `;

        const listValues = isExport ? baseValues : [...baseValues, pageSize, offset];

        const [cntRes, listRes] = await Promise.all([
            client.query(countSql, baseValues),
            client.query(listSql, listValues),
        ]);

        return NextResponse.json({
            success: true,
            rows: listRes.rows,
            meta: {
                total: cntRes.rows[0]?.total ?? 0,
                page,
                pageSize: isExport ? listRes.rows.length : pageSize,
            },
        });
    } catch (err: any) {
        console.error('[GET /api/activities] error:', err);
        return NextResponse.json(
            {
                success: false,
                error: err?.message ?? '조회 실패',
            },
            { status: 500 }
        );
    } finally {
        client.release();
    }
}

// ========================== POST ==========================
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

            if (!region || !name) {
                throw new Error('지역/이름 누락');
            }

            const dateOnly = parseISODateOnly(row.날짜 ?? null);
            const finalDate = dateOnly ?? formatDateLocal(new Date());

            let memberId: string | null = (row.member_id ?? '').trim() || null;

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

            await client.query(
                `
                INSERT INTO member_activities (activity_date, member_id, role, memo)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (activity_date, member_id, role)
                DO UPDATE SET memo = COALESCE(EXCLUDED.memo, member_activities.memo)
                `,
                [finalDate, memberId, role, memo]
            );
        }

        await client.query('COMMIT');
        return NextResponse.json({ success: true, message: '저장 성공' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('[POST /api/activities] error:', err);
        return NextResponse.json(
            {
                success: false,
                message: err?.message ?? '저장 실패',
            },
            { status: 500 }
        );
    } finally {
        client.release();
    }
}
