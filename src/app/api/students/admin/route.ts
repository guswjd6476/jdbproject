// app/api/students/admin/route.ts
import { pool } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// export async function GET() {
//     try {
//         const client = await pool.connect();
//         const result = await client.query('SELECT * FROM students ORDER BY "id" ASC');
//         client.release();

//         const rows = result.rows;
//         if (!Array.isArray(rows)) {
//             return new Response(JSON.stringify({ message: '데이터가 배열이 아님' }), { status: 500 });
//         }

//         return new Response(JSON.stringify(rows), {
//             status: 200,
//             headers: { 'Content-Type': 'application/json' },
//         });
//     } catch (err) {
//         console.error('학생 조회 실패:', err);
//         return new Response(JSON.stringify({ message: '서버 오류' }), { status: 500 });
//     }
// }

export async function GET(request: NextRequest) {
    const client = await pool.connect();
    try {
        const search = request.nextUrl.searchParams.get('q')?.trim();

        let baseQuery = `
            SELECT 
                s.id , s.단계, s.이름, s.연락처, s.생년월일, 
                s.인도자_고유번호, s.교사_고유번호,
                s.발_완료일 , s.찾_완료일 , s.합_완료일 ,
                s.섭_완료일, s.복_완료일, s.예정_완료일 ,
  s.센확_완료일 , s.탈락 ,s.target,
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
