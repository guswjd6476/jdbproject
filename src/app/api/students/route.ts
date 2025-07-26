import { pool } from '@/app/lib/db';
import { Student } from '@/app/lib/types';
import { NextRequest, NextResponse } from 'next/server';
import { PoolClient } from 'pg';
import { verifyToken } from '@/app/lib/auth';
import type { JwtPayload } from 'jsonwebtoken';

const 단계순서 = ['A', 'B', 'C', 'D-1', 'D-2', 'E', 'F', '탈락'];

// 사용자가 제공한 헬퍼 함수 (수정 없음)
async function getMemberUniqueId(client: PoolClient, 지역: string, 팀: string, 이름: string): Promise<string | null> {
    if (!지역 || !팀 || !이름) return null;
    const prefix = 팀.charAt(0);
    const query = `
        SELECT 고유번호 FROM members
        WHERE 지역 = $1 AND 구역 LIKE $2 AND 이름 = $3
        LIMIT 1
    `;
    const values = [지역, prefix + '%', 이름];
    const res = await client.query(query, values);
    return res.rows.length > 0 ? res.rows[0].고유번호 : null;
}

// 사용자가 제공한 헬퍼 함수 (수정 없음)
async function getOrInsertMemberUniqueId(
    client: PoolClient,
    지역: string,
    팀: string,
    이름: string
): Promise<string | null> {
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
            SELECT 고유번호 FROM members
            WHERE 지역 = $1 AND 이름 = $2
            LIMIT 1
        `;
        findValues = [trimmedRegion, trimmedName];
    } else {
        if (!trimmedTeam) return null;
        findQuery = `
            SELECT 고유번호 FROM members
            WHERE 지역 = $1 AND 팀 = $2 AND 이름 = $3
            LIMIT 1
        `;
        findValues = [trimmedRegion, trimmedTeam, trimmedName];
    }

    const res = await client.query(findQuery, findValues);

    if (res.rows.length > 0) {
        return res.rows[0].고유번호;
    }

    if (isSpecialRegion) {
        const insertQuery = `
        INSERT INTO members (고유번호, 지역, 이름)
        VALUES (gen_random_uuid(), $1, $2)
        RETURNING 고유번호
    `;
        const insertValues = [trimmedRegion, trimmedName];
        const insertRes = await client.query(insertQuery, insertValues);
        console.log(`새로운 멤버 추가: ${trimmedName} (${trimmedRegion})`);
        return insertRes.rows[0].고유번호;
    }

    return null;
}

const 단계완료일컬럼: Record<string, string> = {
    A: 'a_완료일',
    B: 'b_완료일',
    C: 'c_완료일',
    'D-1': 'd_1_완료일',
    'D-2': 'd_2_완료일',
    E: 'e_완료일',
    F: 'f_완료일',
    탈락: 'g',
    센확: '센확_완료일',
};

// GET 함수 (수정 없음)
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
                s.id AS 번호, s.단계, s.이름, s.연락처, s.생년월일, s.target,
                s.인도자_고유번호, s.교사_고유번호,
                s.a_완료일 AS "a", s.b_완료일 AS "b", s.c_완료일 AS "c",
                s.d_1_완료일 AS "d-1", s.d_2_완료일 AS "d-2", s.e_완료일 AS "e",
                s.f_완료일 AS "f", s.센확_완료일 AS "센확", s.탈락 AS "g",
                m_ind.지역 AS 인도자지역, m_ind.구역 AS 인도자팀, m_ind.이름 AS 인도자이름,
                m_tch.지역 AS 교사지역, m_tch.구역 AS 교사팀, m_tch.이름 AS 교사이름
            FROM students s
            LEFT JOIN members m_ind ON s.인도자_고유번호 = m_ind.고유번호
            LEFT JOIN members m_tch ON s.교사_고유번호 = m_tch.고유번호
        `;

        const values: string[] = [];
        const whereConditions: string[] = [];

        if (search) {
            whereConditions.push(
                `(s.이름 ILIKE $1 OR m_ind.이름 ILIKE $1 OR m_tch.이름 ILIKE $1 OR m_ind.지역 ILIKE $1 OR m_tch.지역 ILIKE $1 OR m_ind.구역 ILIKE $1 OR m_tch.구역 ILIKE $1)`
            );
            values.push(`%${search}%`);
        }

        const regionMappings: { [key: string]: string } = {
            nowon: '노원',
            dobong: '도봉',
            sungbook: '성북',
            joongrang: '중랑',
            gangbook: '강북',
            dae: '대학',
            sae: '새신자',
        };

        for (const key in regionMappings) {
            if (userEmail.includes(key)) {
                const paramIndex = values.length + 1;
                whereConditions.push(`(m_ind.지역 = $${paramIndex} OR m_tch.지역 = $${paramIndex})`);
                values.push(regionMappings[key]);
                break;
            }
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

// POST 함수 (✨ 수정됨)
export async function POST(request: NextRequest) {
    const client = await pool.connect();
    try {
        // --- ✨ 1. 트랜잭션 시작 ---
        await client.query('BEGIN');

        const body = await request.json();
        const data = body.data || [];
        const dryRun = body.dryRun === true;
        const now = new Date();

        if (dryRun) {
            const invalid = data.some(
                (r: { 이름: string; 단계: string }) =>
                    !r.이름?.trim() || !단계순서.includes(r.단계?.trim().toUpperCase())
            );
            if (invalid) {
                return NextResponse.json(
                    { success: false, message: '유효하지 않은 데이터가 포함되어 있습니다.' },
                    { status: 400 }
                );
            }
            const summary = data.map((r: { 이름: string; 단계: string }) => ({
                이름: r.이름.trim(),
                단계: r.단계.trim().toUpperCase(),
            }));
            return NextResponse.json({ success: true, summary });
        }

        for (const row of data) {
            const 단계 = row.단계.trim().toUpperCase();
            row.인도자_고유번호 = await getOrInsertMemberUniqueId(client, row.인도자지역, row.인도자팀, row.인도자이름);
            row.교사_고유번호 = ['A', 'B'].includes(단계)
                ? null
                : await getOrInsertMemberUniqueId(client, row.교사지역, row.교사팀, row.교사이름);

            let existingRes;
            if (row.인도자_고유번호) {
                existingRes = await client.query(
                    'SELECT * FROM students WHERE 이름 = $1 AND 인도자_고유번호 = $2 ORDER BY id DESC LIMIT 1',
                    [row.이름.trim(), row.인도자_고유번호]
                );
            } else if (row.교사_고유번호) {
                existingRes = await client.query(
                    'SELECT * FROM students WHERE 이름 = $1 AND 교사_고유번호 = $2 ORDER BY id DESC LIMIT 1',
                    [row.이름.trim(), row.교사_고유번호]
                );
            } else {
                existingRes = { rows: [] };
            }

            const existing = existingRes.rows.length > 0 ? existingRes.rows[0] : null;

            // --- ✨ 2. 이전 단계 완료일 확인 로직 ---
            if (existing) {
                const currentStageIndex = 단계순서.indexOf(단계);
                if (currentStageIndex > 0) {
                    const previousStage = 단계순서[currentStageIndex - 1];
                    const prevStageCompletionDateCol = 단계완료일컬럼[previousStage];

                    if (prevStageCompletionDateCol && existing[prevStageCompletionDateCol]) {
                        const completionDate = new Date(existing[prevStageCompletionDateCol]);
                        const today = new Date();
                        completionDate.setHours(0, 0, 0, 0);
                        today.setHours(0, 0, 0, 0);

                        if (completionDate.getTime() === today.getTime()) {
                            throw new Error(
                                `'${row.이름}' 학생은 '${previousStage}' 단계를 오늘 완료하여 다음 단계 등록이 불가능합니다.`
                            );
                        }
                    }
                }
            }
            // --- ✨ 로직 종료 ---

            const 완료일: { [key: string]: Date | null } = {
                a_완료일: null,
                b_완료일: null,
                c_완료일: null,
                d_1_완료일: null,
                d_2_완료일: null,
                e_완료일: null,
                f_완료일: null,
                센확_완료일: null,
                g: null,
            };
            const colName = 단계완료일컬럼[단계];
            if (colName) 완료일[colName] = now;

            if (existing) {
                await client.query(
                    `UPDATE students SET
                        단계 = $1, 연락처 = COALESCE($2, 연락처), 생년월일 = COALESCE($3, 생년월일),
                        인도자_고유번호 = COALESCE($4, 인도자_고유번호), 교사_고유번호 = COALESCE($5, 교사_고유번호),
                        a_완료일 = COALESCE(a_완료일, $6), b_완료일 = COALESCE(b_완료일, $7),
                        c_완료일 = COALESCE(c_완료일, $8), d_1_완료일 = COALESCE(d_1_완료일, $9),
                        d_2_완료일 = COALESCE(d_2_완료일, $10), e_완료일 = COALESCE(e_완료일, $11),
                        f_완료일 = COALESCE(f_완료일, $12), 센확_완료일 = COALESCE(센확_완료일, $13),
                        탈락 = COALESCE(탈락, $14)
                    WHERE id = $15`,
                    [
                        단계,
                        row.연락처,
                        row.생년월일,
                        row.인도자_고유번호,
                        row.교사_고유번호,
                        완료일.a_완료일,
                        완료일.b_완료일,
                        완료일.c_완료일,
                        완료일.d_1_완료일,
                        완료일.d_2_완료일,
                        완료일.e_완료일,
                        완료일.f_완료일,
                        완료일.센확_완료일,
                        완료일.g,
                        existing.id,
                    ]
                );
            } else {
                await client.query(
                    `INSERT INTO students
                        (단계, 이름, 연락처, 생년월일, 인도자_고유번호, 교사_고유번호, a_완료일, b_완료일, c_완료일, d_1_완료일, d_2_완료일, e_완료일, f_완료일, 센확_완료일, 탈락)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                    [
                        단계,
                        row.이름.trim(),
                        row.연락처,
                        row.생년월일,
                        row.인도자_고유번호,
                        row.교사_고유번호,
                        완료일.a_완료일,
                        완료일.b_완료일,
                        완료일.c_완료일,
                        완료일.d_1_완료일,
                        완료일.d_2_완료일,
                        완료일.e_완료일,
                        완료일.f_완료일,
                        완료일.센확_완료일,
                        완료일.g,
                    ]
                );
            }
        }

        // --- ✨ 3. 모든 작업이 성공하면 트랜잭션 커밋 ---
        await client.query('COMMIT');
        return NextResponse.json({ success: true });
    } catch (err) {
        // --- ✨ 4. 에러 발생 시 트랜잭션 롤백 ---
        await client.query('ROLLBACK');
        console.error('POST /api/students 에러:', err);
        const message = err instanceof Error ? err.message : '서버 오류가 발생했습니다.';
        return NextResponse.json({ success: false, message }, { status: 500 });
    } finally {
        client.release();
    }
}
