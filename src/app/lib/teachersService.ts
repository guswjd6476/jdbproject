// src/app/lib/teachersService.ts
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export interface TeacherData {
    고유번호: string;
    이름: string;
    지역: string;
    구역: string;
    교사형태: string;
    uid: string;
    reason: string | null;
    fail: boolean | null;
    마지막업데이트: string;
    활동여부: '활동' | '비활동';
    c이상건수: number;
}

// 텔레그램 및 기존 GET API가 공통으로 사용할 데이터 조회 함수
export async function getTeachersDataDirectly(): Promise<TeacherData[]> {
    const client = await pool.connect();
    try {
        // 기존 GET에 있던 비즈니스 로직 쿼리 그대로 반영
        const baseQuery = `
            SELECT
                m.고유번호, m.이름, m.지역, m.구역,
                t.type AS "교사형태",
                t.uid, t.reason, t.fail,
                to_char(t.updated_at, 'YYYY-MM-DD') AS "마지막업데이트",
                CASE
                    WHEN EXISTS (
                        SELECT 1 FROM students s WHERE s.교사_고유번호 = m.고유번호
                        AND (
                            (CURRENT_DATE < '2025-09-01' AND (s.복_완료일 >= '2025-06-01' OR s.예정_완료일 >= '2025-06-01' OR s.센확_완료일 >= '2025-06-01'))
                            OR
                            (CURRENT_DATE >= '2025-09-01' AND (s.복_완료일 >= CURRENT_DATE - INTERVAL '3 months' OR s.예정_완료일 >= CURRENT_DATE - INTERVAL '3 months' OR s.센확_완료일 >= CURRENT_DATE - INTERVAL '3 months'))
                            OR
                            (s.단계 IN ('복', '예정', '센확'))
                        )
                    )
                    THEN '활동'
                    ELSE '비활동'
                END AS "활동여부",
                (
                    SELECT COUNT(*) FROM students s
                    WHERE s.교사_고유번호 = m.고유번호 AND s.단계 IN ('섭', '복', '예정', '센확')
                ) AS "c이상건수"
            FROM teachers t
            JOIN members m ON m.고유번호 = t.uid
            ORDER BY m.이름 ASC
        `;

        const res = await client.query(baseQuery);
        return res.rows;
    } catch (err) {
        console.error('getTeachersDataDirectly 에러:', err);
        throw err;
    } finally {
        client.release();
    }
}
