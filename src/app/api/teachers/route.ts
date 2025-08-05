import { verifyToken } from '@/app/lib/auth';
import { JwtPayload } from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

interface Teacher {
    고유번호: string;
    등록구분: string;
}

export async function POST(request: NextRequest) {
    try {
        const teachers: Teacher[] = await request.json();

        if (!Array.isArray(teachers)) {
            return NextResponse.json({ error: '배열 형태로 요청해주세요.' }, { status: 400 });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            for (const t of teachers) {
                await client.query(
                    `
          INSERT INTO teachers (uid, type, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (uid) DO UPDATE 
            SET type = EXCLUDED.type,
                updated_at = NOW()
          `,
                    [t.고유번호, t.등록구분]
                );
            }

            await client.query('COMMIT');

            const result = await client.query(
                `
        SELECT 
          m.고유번호, 
          m.이름, 
          m.지역, 
          m.구역, 
          t.type AS 교사형태,
          to_char(t.updated_at, 'YYYY-MM-DD HH24:MI:SS') AS "마지막업데이트"
        FROM teachers t
        JOIN members m ON m.고유번호 = t.uid
        WHERE t.uid = ANY($1)
        ORDER BY t.uid
        `,
                [teachers.map((t) => t.고유번호)]
            );

            client.release();
            return NextResponse.json(result.rows);
        } catch (e) {
            await client.query('ROLLBACK');
            client.release();
            console.error(e);
            return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
        }
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }
}

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
                m.고유번호,
                m.이름,
                m.지역,
                m.구역,
                t.type AS 교사형태,
                t.uid,
                t.reason,
                t.fail,
                to_char(t.updated_at, 'YYYY-MM-DD') AS "마지막업데이트",

                CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM students s
                        WHERE s.교사_고유번호 = m.고유번호
                          AND (
                              (
                                  CURRENT_DATE < '2025-09-01' AND (
                                      s.복_완료일 >= '2025-06-01' OR
                                      s.예정_완료일 >= '2025-06-01' OR
                                      s.센확_완료일 >= '2025-06-01'
                                  )
                              )
                              OR
                              (
                                  CURRENT_DATE >= '2025-09-01' AND (
                                      s.복_완료일 >= CURRENT_DATE - INTERVAL '3 months' OR
                                      s.예정_완료일 >= CURRENT_DATE - INTERVAL '3 months' OR
                                      s.센확_완료일 >= CURRENT_DATE - INTERVAL '3 months'
                                  )
                              )
                              OR
                              (
                                  s.단계 IN ('복', '예정', '센확')
                              )
                          )
                    )
                    THEN '활동'
                    ELSE '비활동'
                END AS 활동여부,

                (
                    SELECT COUNT(*)
                    FROM students s
                    WHERE s.교사_고유번호 = m.고유번호
                      AND s.단계 IN ('섭', '복', '예정', '센확')
                ) AS c이상건수

            FROM teachers t
            JOIN members m ON m.고유번호 = t.uid
        `;

        const values: string[] = [];
        const whereConditions: string[] = [];

        if (search) {
            whereConditions.push(`(
                m.이름 ILIKE $${values.length + 1} OR
                m.지역 ILIKE $${values.length + 1} OR
                m.구역 ILIKE $${values.length + 1}
            )`);
            values.push(`%${search}%`);
        }

        if (userEmail.includes('nowon')) {
            whereConditions.push(`m.지역 = '노원'`);
        } else if (userEmail.includes('dobong')) {
            whereConditions.push(`m.지역 = '도봉'`);
        } else if (userEmail.includes('sungbook')) {
            whereConditions.push(`m.지역 = '성북'`);
        } else if (userEmail.includes('joongrang')) {
            whereConditions.push(`m.지역 = '중랑'`);
        } else if (userEmail.includes('gangbook')) {
            whereConditions.push(`m.지역 = '강북'`);
        } else if (userEmail.includes('dae')) {
            whereConditions.push(`m.지역 = '대학'`);
        } else if (userEmail.includes('sae')) {
            whereConditions.push(`m.지역 = '새신자'`);
        }

        if (whereConditions.length > 0) {
            baseQuery += ' WHERE ' + whereConditions.join(' AND ');
        }

        baseQuery += ' ORDER BY m.이름 ASC';

        const res = await client.query(baseQuery, values);
        return NextResponse.json(res.rows);
    } catch (err: unknown) {
        console.error('GET /api/teachers 에러:', err);
        const message = err instanceof Error ? err.message : '데이터 조회 실패';
        return NextResponse.json({ error: message }, { status: 500 });
    } finally {
        client.release();
    }
}
