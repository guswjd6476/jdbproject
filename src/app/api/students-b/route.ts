import { pool } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/app/lib/auth';
import type { JwtPayload } from 'jsonwebtoken';
import { getQueryConditionForUser } from '@/app/lib/authUtils';

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

        /**
         * 🔥 핵심 포인트
         * - LATERAL JOIN 으로 학생별 target 히스토리 집계
         * - prevTarget: 가장 최근 "이전" 값
         * - targetChangeCount: 총 변경 횟수
         */
        let baseQuery = `
            SELECT 
                s.id AS "번호",
                s.단계,
                s.이름,
                s.연락처,
                s.target,
                s.trydate,
                s.numberofweek,
                s.생년월일,

                s.발_완료일 AS "발",
                s.찾_완료일 AS "찾",
                s.합_완료일 AS "합",
                s.섭_완료일 AS "섭",
                s.복_완료일 AS "복",
                s.예정_완료일 AS "예정",
                s.센확_완료일 AS "센확",
                s.탈락 AS "g",

                m_ind.지역 AS "인도자지역",
                m_ind.구역 AS "인도자팀",
                m_ind.이름 AS "인도자이름",

                m_tch.지역 AS "교사지역",
                m_tch.구역 AS "교사팀",
                m_tch.이름 AS "교사이름",

                -- ✅ 이전 목표 (가장 최근 이전 값)
                h.prev_target AS "prevTarget",

                -- ✅ 변경 횟수
                COALESCE(h.change_count, 0) AS "targetChangeCount"

            FROM students s

            LEFT JOIN members m_ind ON s.인도자_고유번호 = m_ind.고유번호
            LEFT JOIN members m_tch ON s.교사_고유번호 = m_tch.고유번호

            -- 🔥 target 히스토리 집계
            LEFT JOIN LATERAL (
                SELECT
                    MAX(change_count) AS change_count,
                    (
                        SELECT target
                        FROM student_target_history h2
                        WHERE h2.student_id = s.id
                        ORDER BY change_count DESC
                        OFFSET 1
                        LIMIT 1
                    ) AS prev_target
                FROM student_target_history h1
                WHERE h1.student_id = s.id
            ) h ON TRUE

            WHERE s.단계 IN ('합', '섭', '복', '예정')
        `;

        const permissionCondition = getQueryConditionForUser(userEmail);
        baseQuery += permissionCondition;
        baseQuery += ' ORDER BY s.id ASC';

        const res = await client.query(baseQuery);
        return NextResponse.json(res.rows);
    } catch (err: unknown) {
        console.error('GET /api/students-b 에러:', err);
        const message = err instanceof Error ? err.message : '데이터 조회 실패';
        return NextResponse.json({ error: message }, { status: 500 });
    } finally {
        client.release();
    }
}
