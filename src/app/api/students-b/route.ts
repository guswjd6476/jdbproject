// src/app/api/students-b/route.ts
import { pool } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/app/lib/auth';
import type { JwtPayload } from 'jsonwebtoken';

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

        let baseQuery = `
            SELECT 
                s.id AS 번호, 
                s.단계, 
                s.이름, 
                s.연락처, 
				s.target,
				s.trydate,
                s.numberofweek,
                s.생년월일,
                s.a_완료일 AS "a",
                s.b_완료일 AS "b",
                s.c_완료일 AS "c",
                s.d_1_완료일 AS "d-1",
                s.d_2_완료일 AS "d-2",
                s.e_완료일 AS "e",
                s.f_완료일 AS "f",
                s.탈락 AS "g",
                s.target, s.trydate,
                m_ind.지역 AS 인도자지역, 
                m_ind.구역 AS 인도자팀, 
                m_ind.이름 AS 인도자이름,
                m_tch.지역 AS 교사지역, 
                m_tch.구역 AS 교사팀, 
                m_tch.이름 AS 교사이름
            FROM students s
            LEFT JOIN members m_ind ON s.인도자_고유번호 = m_ind.고유번호
            LEFT JOIN members m_tch ON s.교사_고유번호 = m_tch.고유번호
            WHERE s.단계 IN ('B', 'C', 'D-1', 'D-2', 'E')
        `;

        if (userEmail.includes('nowon')) {
            baseQuery += ` AND (m_ind.지역 = '노원' OR m_tch.지역 = '노원')`;
        } else if (userEmail.includes('dobong')) {
            baseQuery += ` AND (m_ind.지역 = '도봉' OR m_tch.지역 = '도봉')`;
        } else if (userEmail.includes('sungbook')) {
            baseQuery += ` AND (m_ind.지역 = '성북' OR m_tch.지역 = '성북')`;
        } else if (userEmail.includes('joongrang')) {
            baseQuery += ` AND (m_ind.지역 = '중랑' OR m_tch.지역 = '중랑')`;
        } else if (userEmail.includes('gangbook')) {
            baseQuery += ` AND (m_ind.지역 = '강북' OR m_tch.지역 = '강북')`;
        } else if (userEmail.includes('dae')) {
            baseQuery += ` AND (m_ind.지역 = '대학' OR m_tch.지역 = '대학')`;
        } else if (userEmail.includes('sae')) {
            baseQuery += ` AND (m_ind.지역 = '새신자' OR m_tch.지역 = '새신자')`;
        }

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
