import { pool } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const client = await pool.connect();
    try {
        const query = `
        SELECT
            m.지역,
            (split_part(m.구역, '-', 1)) || '팀' AS 팀,
            tl.팀장,
            tl.교관,
            COUNT(DISTINCT t.uid) AS 교사재적,
            COUNT(DISTINCT CASE
                WHEN s.단계 IN ('복', '예정', '센확')
                AND (
                    (
                        CURRENT_DATE < '2025-09-01'
                        AND (
                            s.복_완료일 >= '2025-06-01' OR
                            s.예정_완료일 >= '2025-06-01' OR
                            s.센확_완료일   >= '2025-06-01' 
                        )
                    )
                    OR
                    (
                        CURRENT_DATE >= '2025-09-01'
                        AND (
                            s.복_완료일 >= CURRENT_DATE - INTERVAL '3 months' OR
                            s.예정_완료일 >= CURRENT_DATE - INTERVAL '3 months' OR
                            s.센확_완료일   >= CURRENT_DATE - INTERVAL '3 months' 
                        )
                    )
                )
                THEN m.고유번호 ELSE NULL
            END) AS 활동교사,
            COUNT(CASE 
                WHEN s.단계 IN ('복', '예정', '센확') THEN 1 ELSE NULL
            END) AS 교사건,
            SUM(CASE 
                WHEN s.numberofweek = '1회' 
                AND s.단계 IN ('복', '예정', '센확') THEN 1 
                ELSE 0
            END) AS 횟수1회,
            SUM(CASE 
                WHEN s.numberofweek = '2회' 
                AND s.단계 IN ('복', '예정', '센확') THEN 1 
                ELSE 0
            END) AS 횟수2회,
            SUM(CASE 
                WHEN s.numberofweek IN ('3회','4회이상') 
                AND s.단계 IN ('복', '예정', '센확') THEN 1 
                ELSE 0
            END) AS 횟수3회이상,
            SUM(CASE 
                WHEN (s.numberofweek IS NULL OR s.numberofweek = '' OR s.numberofweek = '미수강') 
                AND s.단계 IN ('복', '예정', '센확') THEN 1 
                ELSE 0
            END) AS 미수강
        FROM members m
        JOIN (
            SELECT * FROM teachers WHERE fail IS NOT TRUE
        ) t ON t.uid = m.고유번호
        LEFT JOIN students s ON s.교사_고유번호 = m.고유번호
        LEFT JOIN team_leaders tl 
            ON tl.지역 = m.지역 
            AND tl.팀 = (split_part(m.구역, '-', 1))
        GROUP BY m.지역, split_part(m.구역, '-', 1), tl.팀장, tl.교관
        ORDER BY m.지역, 팀
        `;

        const res = await client.query(query);
        return NextResponse.json(res.rows);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 });
    } finally {
        client.release();
    }
}
