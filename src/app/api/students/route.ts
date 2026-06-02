import { pool } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { PoolClient } from 'pg';
import { verifyToken } from '@/app/lib/auth';
import type { JwtPayload } from 'jsonwebtoken';
import { getParameterizedQueryConditionForUser } from '@/app/lib/authUtils';

const 단계순서 = ['발', '찾', '합', '섭', '복', '예정', '센확'];

async function getOrInsertMemberUniqueId(
    client: PoolClient,
    지역: string,
    팀: string,
    이름: string,
): Promise<string | null | any[]> {
    if (!지역?.trim() || !이름?.trim()) {
        return null;
    }
    const trimmedRegion = 지역.trim();
    const trimmedTeam = 팀.trim();
    const trimmedName = 이름.trim();

    const specialRegions = ['타지파', '타부서', '지교회'];
    const isSpecialRegion = specialRegions.includes(trimmedRegion);

    let findQuery: string;
    let findValues: string[];

    if (isSpecialRegion) {
        findQuery = `
            SELECT 고유번호, 이름, 지역, 구역 as 팀 FROM members
            WHERE 지역 = $1 AND 이름 = $2
        `;
        findValues = [trimmedRegion, trimmedName];
    } else {
        if (!trimmedTeam) return null;
        const prefix = trimmedTeam.charAt(0);
        findQuery = `
            SELECT 고유번호, 이름, 지역, 구역 as 팀 FROM members
            WHERE 지역 = $1 AND 구역 LIKE $2 AND 이름 = $3
        `;
        findValues = [trimmedRegion, prefix + '%', trimmedName];
    }

    const res = await client.query(findQuery, findValues);

    if (res.rows.length > 1) {
        return res.rows;
    }
    if (res.rows.length === 1) {
        return res.rows[0].고유번호;
    }
    if (isSpecialRegion) {
        const insertQuery = `
            INSERT INTO members (고유번호, 지역, 이름, 구역)
            VALUES (gen_random_uuid(), $1, $2, $3)
            RETURNING 고유번호
        `;
        const insertValues = [trimmedRegion, trimmedName, trimmedTeam];
        const insertRes = await client.query(insertQuery, insertValues);
        console.log(`새로운 멤버 추가: ${trimmedName} (${trimmedRegion})`);
        return insertRes.rows[0].고유번호;
    }

    return null;
}

const 단계완료일컬럼: Record<string, string> = {
    발: '발_완료일',
    찾: '찾_완료일',
    합: '합_완료일',
    섭: '섭_완료일',
    복: '복_완료일',
    예정: '예정_완료일',
    탈락: '탈락',
    센확: '센확_완료일',
};

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

        const search = request.nextUrl.searchParams.get('q')?.trim();

        let baseQuery = `
            SELECT 
                s.id AS "번호", s.단계, s.이름, s.연락처, s.생년월일, s.target, s.도구,
                s.인도자_고유번호, s.교사_고유번호,
                s.발_완료일 AS "발", s.찾_완료일 AS "찾", s.합_완료일 AS "합",
                s.섭_완료일 AS "섭", s.복_완료일 AS "복", s.예정_완료일 AS "예정",
                s.센확_완료일 AS "센확", s.탈락 AS "g",  s.target,
                m_ind.지역 AS "인도자지역", m_ind.구역 AS "인도자팀", m_ind.이름 AS "인도자이름",
                m_tch.지역 AS "교사지역", m_tch.구역 AS "교사팀", m_tch.이름 AS "교사이름"
            FROM students s
            LEFT JOIN members m_ind ON s.인도자_고유번호 = m_ind.고유번호
            LEFT JOIN members m_tch ON s.교사_고유번호 = m_tch.고유번호
        `;

        const values: any[] = [];
        const whereConditions: string[] = [];

        if (search) {
            whereConditions.push(
                `(s.이름 ILIKE $1 OR m_ind.이름 ILIKE $1 OR m_tch.이름 ILIKE $1 OR m_ind.지역 ILIKE $1 OR m_tch.지역 ILIKE $1 OR m_ind.구역 ILIKE $1 OR m_tch.구역 ILIKE $1)`,
            );
            values.push(`%${search}%`);
        }

        const permissionParam = getParameterizedQueryConditionForUser(userEmail, values.length + 1);

        if (permissionParam.condition) {
            whereConditions.push(permissionParam.condition);
            values.push(...permissionParam.values);
        }

        if (whereConditions.length > 0) {
            baseQuery += ' WHERE ' + whereConditions.join(' AND ');
        }
        baseQuery += ' ORDER BY s.id ASC';

        const res = await client.query(baseQuery, values);
        return NextResponse.json(res.rows);
    } catch (err: unknown) {
        console.error('GET /api/students 에러:', err);
        const message = err instanceof Error ? err.message : '데이터 조회 실패';
        return NextResponse.json({ error: message }, { status: 500 });
    } finally {
        client.release();
    }
}

export async function POST(request: NextRequest) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const body = await request.json();
        const data = body.data || [];
        const now = new Date();

        const token = request.cookies.get('token')?.value;
        let userRole: string | null = null;
        let isSuperAdmin = false;

        if (token) {
            try {
                const user = verifyToken(token);
                if (typeof user === 'object' && user !== null) {
                    const hasSuperRole = 'role' in user && user.role === 'superAdmin';
                    const hasSuperEmail = 'email' in user && user.email === 'jdb@jdb.com';

                    if (hasSuperRole || hasSuperEmail) {
                        isSuperAdmin = true;
                    }

                    if ('email' in user) {
                        userRole = (user as JwtPayload).email ?? null;
                    }
                }
            } catch (err) {
                console.error('토큰 검증 실패:', err);
                userRole = null;
                isSuperAdmin = false;
            }
        }

        const emptyToNull = (val: any) => {
            if (typeof val === 'string' && val.trim() === '') return null;
            return val ?? null;
        };

        for (const row of data) {
            const 단계 = row.단계.trim().toUpperCase();

            // 💡 벨리데이션 체크 (일반 유저인 경우에만 생년월일 필수 적용 예시 - 필요시 주석 해제)
            // if (!isSuperAdmin && (!row.생년월일 || row.생년월일.trim() === '')) {
            //     throw new Error(`'${row.이름}' 학생의 생년월일은 필수 입력 항목입니다.`);
            // }

            if (!row.인도자_고유번호) {
                const indojaResult = await getOrInsertMemberUniqueId(
                    client,
                    row.인도자지역,
                    row.인도자팀,
                    row.인도자이름,
                );
                if (Array.isArray(indojaResult)) {
                    await client.query('ROLLBACK');
                    return NextResponse.json(
                        {
                            success: false,
                            code: 'NEEDS_SELECTION',
                            context: { rowIndex: row.originalIndex, field: '인도자', choices: indojaResult },
                        },
                        { status: 409 },
                    );
                }
                row.인도자_고유번호 = indojaResult;
            }

            if (!['발', '찾'].includes(단계) && !row.교사_고유번호) {
                const gyosaResult = await getOrInsertMemberUniqueId(client, row.교사지역, row.교사팀, row.교사이름);
                if (Array.isArray(gyosaResult)) {
                    await client.query('ROLLBACK');
                    return NextResponse.json(
                        {
                            success: false,
                            code: 'NEEDS_SELECTION',
                            context: { rowIndex: row.originalIndex, field: '교사', choices: gyosaResult },
                        },
                        { status: 409 },
                    );
                }
                row.교사_고유번호 = gyosaResult;
            }

            const existingRes = await client.query(
                `SELECT * FROM students WHERE 이름 = $1 AND (인도자_고유번호 = $2 OR 교사_고유번호 = $3) ORDER BY id DESC LIMIT 1`,
                [row.이름.trim(), row.인도자_고유번호, row.교사_고유번호],
            );
            const existing = existingRes.rows[0];

            // 🛠️ Target 변경 이력 로직 정합성 보정 (최초 변경인 경우 0번 회차부터 생성)
            if (existing && row.target && existing.target !== row.target) {
                // 기존 히스토리 로우 개수를 조회합니다.
                const countRes = await client.query(
                    `SELECT COUNT(*)::int AS history_count, COALESCE(MAX(change_count), 0) AS max_change 
                     FROM student_target_history WHERE student_id = $1`,
                    [existing.id],
                );

                const historyCount = countRes.rows[0].history_count;
                const maxChange = countRes.rows[0].max_change;

                // 히스토리가 아예 없었다면 최초 등록이므로 0, 존재한다면 max_change + 1
                const nextChangeCount = historyCount === 0 ? 0 : maxChange + 1;

                await client.query(
                    `INSERT INTO student_target_history (student_id, target, change_count) VALUES ($1, $2, $3)`,
                    [existing.id, row.target, nextChangeCount],
                );
            }

            if (existing && !isSuperAdmin) {
                const currentIdx = 단계순서.indexOf(단계);
                if (currentIdx > 0) {
                    const prevStage = 단계순서[currentIdx - 1];
                    const prevCol = 단계완료일컬럼[prevStage];
                    if (prevCol && existing[prevCol]) {
                        const compDate = new Date(existing[prevCol]);
                        if (compDate.toDateString() === now.toDateString()) {
                            throw new Error(
                                `'${row.이름}' 학생은 오늘 '${prevStage}' 단계를 완료하여 승급이 불가합니다.`,
                            );
                        }
                    }
                }
            }

            const 완료일: Record<string, Date | null> = {
                발_완료일: null,
                찾_완료일: null,
                합_완료일: null,
                섭_완료일: null,
                복_완료일: null,
                예정_완료일: null,
                센확_완료일: null,
                탈락: null,
            };

            const currentColName = 단계완료일컬럼[단계];
            if (currentColName) {
                완료일[currentColName] = now;
            }

            console.log('isSuperAdmin 결과:', isSuperAdmin);

            if (isSuperAdmin && 단계 !== '탈락') {
                const currentIdx = 단계순서.indexOf(단계);
                if (currentIdx > 0) {
                    for (let i = 0; i < currentIdx; i++) {
                        const prevStage = 단계순서[i];
                        const prevColName = 단계완료일컬럼[prevStage];

                        if (!existing || !existing[prevColName]) {
                            완료일[prevColName] = now;
                        }
                    }
                }
            }

            if (existing) {
                await client.query(
                    `UPDATE students SET
                        단계 = $1, 
                        연락처 = COALESCE($2, 연락처), 
                        생년월일 = COALESCE($3, 생년월일),
                        인도자_고유번호 = COALESCE($4, 인도자_고유번호),
                        교사_고유번호 = COALESCE($5, 교사_고유번호),
                        발_완료일 = COALESCE(발_완료일, $6),
                        찾_완료일 = COALESCE(찾_완료일, $7),
                        합_완료일 = COALESCE(합_완료일, $8),
                        섭_완료일 = COALESCE(섭_완료일, $9),
                        복_완료일 = COALESCE(복_완료일, $10),
                        예정_완료일 = COALESCE(예정_완료일, $11),
                        센확_완료일 = COALESCE(센확_완료일, $12),
                        탈락 = COALESCE(탈락, $13),
                        도구 = COALESCE($14, 도구),
                        target = COALESCE($15, target)
                     WHERE id = $16`,
                    [
                        단계,
                        emptyToNull(row.연락처),
                        emptyToNull(row.생년월일),
                        emptyToNull(row.인도자_고유번호),
                        emptyToNull(row.교사_고유번호),
                        완료일.발_완료일,
                        완료일.찾_완료일,
                        완료일.합_완료일,
                        완료일.섭_완료일,
                        완료일.복_완료일,
                        완료일.예정_완료일,
                        완료일.센확_완료일,
                        완료일.탈락,
                        emptyToNull(row.도구),
                        emptyToNull(row.target),
                        existing.id,
                    ],
                );
            } else {
                await client.query(
                    `INSERT INTO students (단계, 이름, 연락처, 생년월일, 인도자_고유번호, 교사_고유번호, 발_완료일, 찾_완료일, 합_완료일, 섭_완료일, 복_완료일, 예정_완료일, 센확_완료일, 탈락, 도구, target)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
                    [
                        단계,
                        row.이름.trim(),
                        emptyToNull(row.연락처),
                        emptyToNull(row.생년월일),
                        row.인도자_고유번호,
                        row.교사_고유번호,
                        완료일.발_완료일,
                        완료일.찾_완료일,
                        완료일.합_완료일,
                        완료일.섭_완료일,
                        완료일.복_완료일,
                        완료일.예정_완료일,
                        완료일.센확_완료일,
                        완료일.탈락,
                        emptyToNull(row.도구),
                        emptyToNull(row.target),
                    ],
                );
            }
        }

        await client.query('COMMIT');
        return NextResponse.json({ success: true, message: '저장 성공' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        return NextResponse.json({ success: false, message: err.message }, { status: 500 });
    } finally {
        client.release();
    }
}

export async function DELETE(request: NextRequest) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { searchParams } = new URL(request.url);
        const idsString = searchParams.get('ids');

        if (!idsString) {
            return NextResponse.json({ success: false, message: '삭제할 ID가 없습니다.' }, { status: 400 });
        }

        const ids = idsString
            .split(',')
            .map((id) => parseInt(id.trim()))
            .filter((id) => !isNaN(id));

        if (ids.length === 0) {
            return NextResponse.json({ success: false, message: '유효한 ID가 없습니다.' }, { status: 400 });
        }

        await client.query(`DELETE FROM students WHERE id = ANY($1::int[])`, [ids]);

        await client.query('COMMIT');
        return NextResponse.json({ success: true, message: '삭제 성공' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        return NextResponse.json({ success: false, message: err.message }, { status: 500 });
    } finally {
        client.release();
    }
}
