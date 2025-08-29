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
    이름: string
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

// ✨ FIX: 'g'를 다시 '탈락'으로 수정합니다.
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
                s.id AS "번호", s.단계, s.이름, s.연락처, s.생년월일, s.target,
                s.인도자_고유번호, s.교사_고유번호,
                s.발_완료일 AS "발", s.찾_완료일 AS "찾", s.합_완료일 AS "합",
                s.섭_완료일 AS "섭", s.복_완료일 AS "복", s.예정_완료일 AS "예정",
                s.센확_완료일 AS "센확", s.탈락 AS "g", 
                m_ind.지역 AS "인도자지역", m_ind.구역 AS "인도자팀", m_ind.이름 AS "인도자이름",
                m_tch.지역 AS "교사지역", m_tch.구역 AS "교사팀", m_tch.이름 AS "교사이름"
            FROM students s
            LEFT JOIN members m_ind ON s.인도자_고유번호 = m_ind.고유번호
            LEFT JOIN members m_tch ON s.교사_고유번호 = m_tch.고유번호
        `;

        const values: any[] = [];
        const whereConditions: string[] = [];

        // 1. 검색어 조건 처리
        if (search) {
            whereConditions.push(
                `(s.이름 ILIKE $1 OR m_ind.이름 ILIKE $1 OR m_tch.이름 ILIKE $1 OR m_ind.지역 ILIKE $1 OR m_tch.지역 ILIKE $1 OR m_ind.구역 ILIKE $1 OR m_tch.구역 ILIKE $1)`
            );
            values.push(`%${search}%`);
        }

        // =================================================================
        //               ↓↓↓ 여기가 변경된 부분입니다 ↓↓↓
        // =================================================================

        // 2. 권한 조건 처리 (authUtils.ts 함수 사용)
        // 현재 파라미터 개수 다음 인덱스부터 시작하도록 설정
        const permissionParam = getParameterizedQueryConditionForUser(userEmail, values.length + 1);

        // authUtils 함수가 반환한 조건과 값을 WHERE 절과 값 배열에 추가
        if (permissionParam.condition) {
            whereConditions.push(permissionParam.condition);
            values.push(...permissionParam.values);
        }

        // =================================================================

        // 3. 최종 쿼리 생성
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

        for (const row of data) {
            const 단계 = row.단계.trim().toUpperCase();

            if (!row.인도자_고유번호) {
                const indojaResult = await getOrInsertMemberUniqueId(
                    client,
                    row.인도자지역,
                    row.인도자팀,
                    row.인도자이름
                );
                if (Array.isArray(indojaResult)) {
                    await client.query('ROLLBACK');
                    return NextResponse.json(
                        {
                            success: false,
                            message: '동명이인이 있습니다. 선택이 필요합니다.',
                            code: 'NEEDS_SELECTION',
                            context: { rowIndex: row.originalIndex, field: '인도자', choices: indojaResult },
                        },
                        { status: 409 }
                    );
                }
                row.인도자_고유번호 = indojaResult as string | null;
            }

            if (!['발', '찾'].includes(단계) && !row.교사_고유번호) {
                const gyosaResult = await getOrInsertMemberUniqueId(client, row.교사지역, row.교사팀, row.교사이름);
                if (Array.isArray(gyosaResult)) {
                    await client.query('ROLLBACK');
                    return NextResponse.json(
                        {
                            success: false,
                            message: '동명이인이 있습니다. 선택이 필요합니다.',
                            code: 'NEEDS_SELECTION',
                            context: { rowIndex: row.originalIndex, field: '교사', choices: gyosaResult },
                        },
                        { status: 409 }
                    );
                }
                row.교사_고유번호 = gyosaResult as string | null;
            }

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
                existingRes = await client.query(
                    'SELECT * FROM students WHERE 이름 = $1 AND 인도자_고유번호 IS NULL AND 교사_고유번호 IS NULL ORDER BY id DESC LIMIT 1',
                    [row.이름.trim()]
                );
            }
            const existing = existingRes.rows.length > 0 ? existingRes.rows[0] : null;

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

            // ✨ FIX: `g`를 다시 `탈락`으로 수정합니다.
            const 완료일: { [key: string]: Date | null } = {
                발_완료일: null,
                찾_완료일: null,
                합_완료일: null,
                섭_완료일: null,
                복_완료일: null,
                예정_완료일: null,
                센확_완료일: null,
                탈락: null,
            };
            const colName = 단계완료일컬럼[단계];
            if (colName) {
                완료일[colName] = now;
            }

            if (existing) {
                await client.query(
                    // ✨ FIX: 쿼리에서 `g`를 다시 `탈락`으로 변경합니다.
                    `UPDATE students SET
                        단계 = $1, 연락처 = COALESCE($2, 연락처), 생년월일 = COALESCE($3, 생년월일),
                        인도자_고유번호 = COALESCE($4, 인도자_고유번호), 교사_고유번호 = COALESCE($5, 교사_고유번호),
                        발_완료일 = COALESCE(발_완료일, $6), 찾_완료일 = COALESCE(찾_완료일, $7),
                        합_완료일 = COALESCE(합_완료일, $8), 섭_완료일 = COALESCE(섭_완료일, $9),
                        복_완료일 = COALESCE(복_완료일, $10), 예정_완료일 = COALESCE(예정_완료일, $11),
                        센확_완료일 = COALESCE(센확_완료일, $12),
                        탈락 = COALESCE(탈락, $13)
                    WHERE id = $14`,
                    [
                        단계,
                        row.연락처,
                        row.생년월일,
                        row.인도자_고유번호,
                        row.교사_고유번호,
                        완료일.발_완료일,
                        완료일.찾_완료일,
                        완료일.합_완료일,
                        완료일.섭_완료일,
                        완료일.복_완료일,
                        완료일.예정_완료일,
                        완료일.센확_완료일,
                        완료일.탈락, // ✨ FIX: '탈락' 컬럼에 해당하는 값을 전달합니다.
                        existing.id,
                    ]
                );
            } else {
                await client.query(
                    // ✨ FIX: 쿼리에서 `g`를 다시 `탈락`으로 변경합니다.
                    `INSERT INTO students
                        (단계, 이름, 연락처, 생년월일, 인도자_고유번호, 교사_고유번호, 발_완료일, 찾_완료일, 합_완료일, 섭_완료일, 복_완료일, 예정_완료일, 센확_완료일, 탈락)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                    [
                        단계,
                        row.이름.trim(),
                        row.연락처,
                        row.생년월일,
                        row.인도자_고유번호,
                        row.교사_고유번호,
                        완료일.발_완료일,
                        완료일.찾_완료일,
                        완료일.합_완료일,
                        완료일.섭_완료일,
                        완료일.복_완료일,
                        완료일.예정_완료일,
                        완료일.센확_완료일,
                        완료일.탈락, // ✨ FIX: '탈락' 컬럼에 해당하는 값을 전달합니다.
                    ]
                );
            }
        }

        await client.query('COMMIT');
        return NextResponse.json({ success: true, message: '성공적으로 저장되었습니다.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('POST /api/students 에러:', err);
        const message = err instanceof Error ? err.message : '서버 오류가 발생했습니다.';
        return NextResponse.json({ success: false, message }, { status: 500 });
    } finally {
        client.release();
    }
}

// export async function POST(request: NextRequest) {
//     const client = await pool.connect();
//     try {
//         await client.query('BEGIN');

//         const body = await request.json();
//         const data = body.data || [];

//         // 🌟 수정: 모든 시간 처리를 UTC 기준으로 통일합니다.
//         // 현재 시점의 UTC Date 객체를 생성합니다.
//         const nowUTC = new Date(); // 이 시점에서 서버의 로컬 시간이지만,
//         // toISOString()을 통해 UTC 문자열로 변환하고, 다시 Date 객체로 파싱하여 명확히 UTC Date 객체를 만듭니다.
//         const currentUTC = new Date(nowUTC.toISOString());

//         for (const row of data) {
//             const 단계 = row.단계.trim().toUpperCase();

//             // ... (동명이인 및 인도자/교사 고유번호 처리 로직 - 변경 없음) ...

//             let existingRes;
//             if (row.인도자_고유번호) {
//                 existingRes = await client.query(
//                     'SELECT * FROM students WHERE 이름 = $1 AND 인도자_고유번호 = $2 ORDER BY id DESC LIMIT 1',
//                     [row.이름.trim(), row.인도자_고유번호]
//                 );
//             } else if (row.교사_고유번호) {
//                 existingRes = await client.query(
//                     'SELECT * FROM students WHERE 이름 = $1 AND 교사_고유번호 = $2 ORDER BY id DESC LIMIT 1',
//                     [row.이름.trim(), row.교사_고유번호]
//                 );
//             } else {
//                 existingRes = await client.query(
//                     'SELECT * FROM students WHERE 이름 = $1 AND 인도자_고유번호 IS NULL AND 교사_고유번호 IS NULL ORDER BY id DESC LIMIT 1',
//                     [row.이름.trim()]
//                 );
//             }
//             const existing = existingRes.rows.length > 0 ? existingRes.rows[0] : null;

//             if (existing) {
//                 const currentStageIndex = 단계순서.indexOf(단계);
//                 if (currentStageIndex > 0) {
//                     const previousStage = 단계순서[currentStageIndex - 1];
//                     const prevStageCompletionDateCol = 단계완료일컬럼[previousStage];
//                     if (prevStageCompletionDateCol && existing[prevStageCompletionDateCol]) {
//                         const completionDateFromDB = new Date(existing[prevStageCompletionDateCol]);

//                         // 🌟 수정: UTC 기준으로 날짜만 비교하도록 합니다.
//                         // 데이터베이스에서 가져온 완료일의 UTC 날짜 부분 (시간은 00:00:00으로 설정)
//                         const completionDateUTC = new Date(
//                             completionDateFromDB.getUTCFullYear(),
//                             completionDateFromDB.getUTCMonth(),
//                             completionDateFromDB.getUTCDate()
//                         );

//                         // 현재 UTC 날짜의 00:00:00 (시간은 00:00:00으로 설정)
//                         const todayUTC = new Date(
//                             currentUTC.getUTCFullYear(),
//                             currentUTC.getUTCMonth(),
//                             currentUTC.getUTCDate()
//                         );

//                         if (completionDateUTC.getTime() === todayUTC.getTime()) {
//                             throw new Error(
//                                 `'${row.이름}' 학생은 '${previousStage}' 단계를 오늘 완료하여 다음 단계 등록이 불가능합니다.`
//                             );
//                         }
//                     }
//                 }
//             }

//             const 완료일: { [key: string]: Date | null } = {
//                 발_완료일: null,
//                 찾_완료일: null,
//                 합_완료일: null,
//                 섭_완료일: null,
//                 복_완료일: null,
//                 예정_완료일: null,
//                 센확_완료일: null,
//                 탈락: null,
//             };
//             const colName = 단계완료일컬럼[단계];
//             if (colName) {
//                 완료일[colName] = currentUTC; // 🌟 수정: UTC Date 객체를 할당합니다.
//             }

//             if (existing) {
//                 await client.query(
//                     `UPDATE students SET
//                         단계 = $1, 연락처 = COALESCE($2, 연락처), 생년월일 = COALESCE($3, 생년월일),
//                         인도자_고유번호 = COALESCE($4, 인도자_고유번호), 교사_고유번호 = COALESCE($5, 교사_고유번호),
//                         발_완료일 = COALESCE(발_완료일, $6), 찾_완료일 = COALESCE(찾_완료일, $7),
//                         합_완료일 = COALESCE(합_완료일, $8), 섭_완료일 = COALESCE(섭_완료일, $9),
//                         복_완료일 = COALESCE(복_완료일, $10), 예정_완료일 = COALESCE(예정_완료일, $11),
//                         센확_완료일 = COALESCE(센확_완료일, $12),
//                         탈락 = COALESCE(탈락, $13)
//                     WHERE id = $14`,
//                     [
//                         단계,
//                         row.연락처,
//                         row.생년월일,
//                         row.인도자_고유번호,
//                         row.교사_고유번호,
//                         완료일.발_완료일,
//                         완료일.찾_완료일,
//                         완료일.합_완료일,
//                         완료일.섭_완료일,
//                         완료일.복_완료일,
//                         완료일.예정_완료일,
//                         완료일.센확_완료일,
//                         완료일.탈락,
//                         existing.id,
//                     ]
//                 );
//             } else {
//                 await client.query(
//                     `INSERT INTO students
//                         (단계, 이름, 연락처, 생년월일, 인도자_고유번호, 교사_고유번호, 발_완료일, 찾_완료일, 합_완료일, 섭_완료일, 복_완료일, 예정_완료일, 센확_완료일, 탈락)
//                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
//                     [
//                         단계,
//                         row.이름.trim(),
//                         row.연락처,
//                         row.생년월일,
//                         row.인도자_고유번호,
//                         row.교사_고유번호,
//                         완료일.발_완료일,
//                         완료일.찾_완료일,
//                         완료일.합_완료일,
//                         완료일.섭_완료일,
//                         완료일.복_완료일,
//                         완료일.예정_완료일,
//                         완료일.센확_완료일,
//                         완료일.탈락,
//                     ]
//                 );
//             }
//         }

//         await client.query('COMMIT');
//         return NextResponse.json({ success: true, message: '성공적으로 저장되었습니다.' });
//     } catch (err) {
//         await client.query('ROLLBACK');
//         console.error('POST /api/students 에러:', err);
//         const message = err instanceof Error ? err.message : '서버 오류가 발생했습니다.';
//         return NextResponse.json({ success: false, message }, { status: 500 });
//     } finally {
//         client.release();
//     }
// }
