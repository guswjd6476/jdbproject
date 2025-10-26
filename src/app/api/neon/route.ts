import { pool } from '@/app/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
    const client = await pool.connect();
    try {
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
                m_ind.이름 AS "인도자",
                m_tch.이름 AS "교사"
            FROM students s
            LEFT JOIN members m_ind ON s.인도자_고유번호 = m_ind.고유번호
            LEFT JOIN members m_tch ON s.교사_고유번호 = m_tch.고유번호
            WHERE s.단계 IN ('찾', '합', '섭', '복')
            ORDER BY s.id ASC;
        `;
        const res = await client.query(query);

        const rows = res.rows;
        if (rows.length === 0) {
            return new Response('번호,이름,연락처,단계,찾,합,섭,복,인도자,교사\n', {
                headers: { 'Content-Type': 'text/csv; charset=utf-8' },
            });
        }

        const header = Object.keys(rows[0]).join(',');
        const csv = rows
            .map((row) =>
                Object.values(row)
                    .map((v) => `"${v ?? ''}"`)
                    .join(',')
            )
            .join('\n');

        const output = `${header}\n${csv}`;
        return new Response(output, {
            headers: { 'Content-Type': 'text/csv; charset=utf-8' },
        });
    } catch (err) {
        console.error('CSV 변환 실패:', err);
        return NextResponse.json({ error: '데이터 변환 실패' }, { status: 500 });
    } finally {
        client.release();
    }
}
