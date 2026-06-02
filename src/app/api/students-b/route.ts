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
         * - LATERAL JOIN 으로 학생별 target 히스토리 정확하게 집계
         * - prevTarget: 현재 target 직전의 최신 변경 이력을 가져옵니다. (없으면 테이블 자체 prevtarget 백업 사용)
         * - targetChangeCount: 실제 변경된 횟수 (총 히스토리 건수 - 1)
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

                -- ✅ 이전 목표: 히스토리 상 현재 직전 값(offset 1)을 최우선으로 하되, 없으면 메인 테이블 컬럼 사용
                COALESCE(h.prev_target, s.prevtarget) AS "prevTarget",

                -- ✅ 변경 횟수 (최초 등록 상태면 0, 변경될 때마다 1, 2, 3... 순으로 매핑)
                COALESCE(h.change_count, 0) AS "targetChangeCount"

            FROM students s

            LEFT JOIN members m_ind ON s.인도자_고유번호 = m_ind.고유번호
            LEFT JOIN members m_tch ON s.교사_고유번호 = m_tch.고유번호

            -- 🔥 target 히스토리 카운트 및 '진짜 직전 목표' 집계 보정
            LEFT JOIN LATERAL (
                SELECT
                    -- 최초 등록(0회차) 데이터 1건만 존재할 때는 변경 횟수가 0이 됨
                    GREATEST(COUNT(*) - 1, 0) AS change_count,
                    
                    -- 현재 s.target으로 업데이트되기 바로 직전(OFFSET 1)의 이력 값을 가져옵니다.
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
