import { pool } from '@/app/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
    const client = await pool.connect();
    try {
        const query = `
        SELECT 
            s.id AS "번호",
            s.이름,
            s.단계,
            s.발_완료일 AS "발",
            s.찾_완료일 AS "찾",
            s.합_완료일 AS "합",
            s.섭_완료일 AS "섭",
            s.복_완료일 AS "복",
            m_ind.지역 AS "인도자지역",
            ('구역' || COALESCE(m_ind.구역::text, '')) AS "인도자팀",
            m_ind.이름 AS "인도자이름",
            m_tch.지역 AS "교사지역",
            ('구역' || COALESCE(m_tch.구역::text, '')) AS "교사팀",
            m_tch.이름 AS "교사이름",
            s.target as 목표월,
        FROM students s
        LEFT JOIN members m_ind ON s.인도자_고유번호 = m_ind.고유번호
        LEFT JOIN members m_tch ON s.교사_고유번호 = m_tch.고유번호
        WHERE s.단계 IN ('발','찾', '합', '섭', '복','목표월'
    )
        ORDER BY s.id ASC;
        `;

        const res = await client.query(query);
        const rows = res.rows;

        const formatDateAsText = (date: any) => {
            if (!date) return '';
            const d = new Date(date);
            if (isNaN(d.getTime())) return ''; // 유효하지 않은 날짜
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        };

        // CSV 변환
        if (rows.length === 0) {
            return new Response(
                '번호,이름,단계,발,찾,합,섭,복,인도자지역,인도자팀,인도자이름,교사지역,교사팀,교사이름\n',
                { headers: { 'Content-Type': 'text/csv; charset=utf-8' } }
            );
        }

        const header = Object.keys(rows[0]).join(',');

        const csv = rows
            .map((row) => {
                return Object.entries(row)
                    .map(([key, v]) => {
                        // 날짜일 경우만 YYYY-MM-DD로 포맷
                        if (v instanceof Date) {
                            v = formatDateAsText(v);
                        }

                        // 인도자팀, 교사팀은 무조건 문자열로 강제 (숫자 깨짐 방지)
                        if (key === '인도자팀' || key === '교사팀') {
                            v = v?.toString().trim() ?? '';
                        }

                        const str = (v ?? '').toString();
                        return `"${str.replace(/"/g, '""')}"`;
                    })
                    .join(',');
            })
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
