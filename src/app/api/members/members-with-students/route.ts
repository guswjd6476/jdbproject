import { NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import dayjs from 'dayjs';

export async function GET(req: Request) {
    const client = await pool.connect();
    try {
        const url = new URL(req.url);
        let start = url.searchParams.get('start');
        let end = url.searchParams.get('end');

        const today = dayjs().format('YYYY-MM-DD');
        if (!start || !end) {
            start = today;
            end = today;
        }

        const query = `
    SELECT
      m.고유번호,
      m.이름,
      m.지역,
      m.ban,

      COUNT(*) FILTER (
        WHERE s.발_완료일 BETWEEN $1 AND $2
          AND m.고유번호 = s.인도자_고유번호
      ) AS 발_건수,

      COUNT(*) FILTER (
        WHERE s.찾_완료일 BETWEEN $1 AND $2
          AND m.고유번호 = s.인도자_고유번호
      ) AS 찾_건수,

      COUNT(*) FILTER (
        WHERE s.합_완료일 BETWEEN $1 AND $2
          AND m.고유번호 = s.인도자_고유번호
      ) AS 합_건수,

      COUNT(*) FILTER (
        WHERE s.섭_완료일 BETWEEN $1 AND $2
          AND m.고유번호 = s.인도자_고유번호
      ) AS 인도섭_건수,

      COUNT(*) FILTER (
        WHERE s.섭_완료일 BETWEEN $1 AND $2
          AND m.고유번호 = s.교사_고유번호
      ) AS 교사섭_건수,

      COUNT(*) FILTER (
        WHERE s.복_완료일 BETWEEN $1 AND $2
          AND m.고유번호 = s.인도자_고유번호
      ) AS 인도복_건수,

      COUNT(*) FILTER (
        WHERE s.복_완료일 BETWEEN $1 AND $2
          AND m.고유번호 = s.교사_고유번호
      ) AS 교사복_건수

    FROM members m
    LEFT JOIN students s
      ON m.고유번호 = s.인도자_고유번호
      OR m.고유번호 = s.교사_고유번호
    WHERE m.ban IS NOT NULL
    GROUP BY m.고유번호, m.이름, m.지역, m.ban
    ORDER BY m.지역, m.ban;
    `;

        const { rows } = await client.query(query, [start, end]);
        return NextResponse.json(rows);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: '조회 실패' }, { status: 500 });
    } finally {
        client.release();
    }
}
