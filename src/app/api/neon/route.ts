import { pool } from '@/app/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
    const client = await pool.connect();
    try {
        // students LEFT JOIN members
        const query = `
            SELECT 
                s.id AS "번호",
                s.이름,
                s.연락처,
                s.단계,
                s.찾_완료일 AS "찾",
                s.합_완료일 AS "합",
                s.섭_완료일 AS "섭",
                s.복_완료일 AS "복",
                m_ind.지역 AS "인도자지역",
                m_ind.구역 AS "인도자팀",
                m_ind.이름 AS "인도자이름",
                m_tch.지역 AS "교사지역",
                m_tch.구역 AS "교사팀",
                m_tch.이름 AS "교사이름"
            FROM students s
            LEFT JOIN members m_ind ON s.인도자_고유번호 = m_ind.고유번호
            LEFT JOIN members m_tch ON s.교사_고유번호 = m_tch.고유번호
            WHERE s.단계 IN ('찾', '합', '섭', '복')
            ORDER BY s.id ASC;
        `;

        const res = await client.query(query);
        const rows = res.rows;
        const formatDateAsText = (date: any) => {
            if (!date) return '';
            const d = new Date(date);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`; // 문자열 그대로
        };

        // CSV 변환
        if (rows.length === 0) {
            return new Response(
                '번호,이름,연락처,단계,찾,합,섭,복,인도자지역,인도자팀,인도자이름,교사지역,교사팀,교사이름\n',
                { headers: { 'Content-Type': 'text/csv; charset=utf-8' } }
            );
        }

        const header = Object.keys(rows[0]).join(',');
        const csv = rows
            .map((row) =>
                Object.values(row)
                    .map((v) => {
                        // 날짜면 YYYY-MM-DD로 변환
                        if (
                            v instanceof Date ||
                            (!isNaN(Date.parse(String(v))) && String(v).match(/\d{4}-\d{1,2}-\d{1,2}/) === null)
                        ) {
                            v = formatDateAsText(v);
                        }
                        // 모든 값 문자열 처리
                        return `"${(v ?? '').toString().replace(/"/g, '""')}"`;
                    })
                    .join(',')
            )
            .join('\n');
        return new Response(`${header}\n${csv}`, {
            headers: { 'Content-Type': 'text/csv; charset=utf-8' },
        });
    } catch (err) {
        console.error('GET /api/students/stages 에러:', err);
        return NextResponse.json({ error: '단계 데이터 조회 실패' }, { status: 500 });
    } finally {
        client.release();
    }
}
