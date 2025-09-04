import { NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import dayjs from 'dayjs';

export async function GET(req: Request) {
    const client = await pool.connect();
    try {
        const url = new URL(req.url);
        let startDate = url.searchParams.get('start'); // YYYY-MM-DD
        let endDate = url.searchParams.get('end'); // YYYY-MM-DD

        // 기간 없으면 오늘 날짜
        const today = dayjs().format('YYYY-MM-DD');
        if (!startDate || !endDate) {
            startDate = today;
            endDate = today;
        }

        const query = `
            SELECT
                m.고유번호,
                m.이름,
                m.지역,
                m.ban,
                COUNT(s.발_완료일) FILTER (WHERE s.발_완료일 BETWEEN $1 AND $2) AS 발_건수,
                COUNT(s.찾_완료일) FILTER (WHERE s.찾_완료일 BETWEEN $1 AND $2) AS 찾_건수,
                COUNT(s.합_완료일) FILTER (WHERE s.합_완료일 BETWEEN $1 AND $2) AS 합_건수,
                COUNT(s.섭_완료일) FILTER (WHERE s.섭_완료일 BETWEEN $1 AND $2) AS 섭_건수,
                COUNT(s.복_완료일) FILTER (WHERE s.복_완료일 BETWEEN $1 AND $2) AS 복_건수
            FROM members m
            LEFT JOIN students s
                ON m.고유번호 = s.인도자_고유번호 OR m.고유번호 = s.교사_고유번호
            WHERE m.ban IS NOT NULL
            GROUP BY m.고유번호, m.이름, m.지역, m.ban
            ORDER BY m.지역, m.ban
        `;

        const { rows } = await client.query(query, [startDate, endDate]);
        return NextResponse.json(rows);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 });
    } finally {
        client.release();
    }
}
