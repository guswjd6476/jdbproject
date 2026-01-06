import { NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import dayjs from 'dayjs';

export async function GET(req: Request) {
    const client = await pool.connect();
    try {
        const url = new URL(req.url);
        const memberId = url.searchParams.get('memberId');
        let start = url.searchParams.get('start');
        let end = url.searchParams.get('end');

        const today = dayjs().format('YYYY-MM-DD');
        if (!start || !end) {
            start = today;
            end = today;
        }

        if (!memberId) {
            return NextResponse.json({ error: 'memberId 누락' }, { status: 400 });
        }

        const query = `
      SELECT
        학생명,
        단계,
        완료일
      FROM (
        /* 발 */
        SELECT
          s.이름 AS 학생명,
          '발' AS 단계,
          s.발_완료일 AS 완료일
        FROM students s
        WHERE s.발_완료일 BETWEEN $2 AND $3
          AND s.인도자_고유번호 = $1

        UNION ALL

        /* 찾 */
        SELECT
          s.이름,
          '찾' AS 단계,
          s.찾_완료일
        FROM students s
        WHERE s.찾_완료일 BETWEEN $2 AND $3
          AND s.인도자_고유번호 = $1

        UNION ALL

        /* 합 */
        SELECT
          s.이름,
          '합' AS 단계,
          s.합_완료일
        FROM students s
        WHERE s.합_완료일 BETWEEN $2 AND $3
          AND s.인도자_고유번호 = $1

        UNION ALL

        /* 인도섭 */
        SELECT
          s.이름,
          '인도섭' AS 단계,
          s.섭_완료일
        FROM students s
        WHERE s.섭_완료일 BETWEEN $2 AND $3
          AND s.인도자_고유번호 = $1

        UNION ALL

        /* 교사섭 */
        SELECT
          s.이름,
          '교사섭' AS 단계,
          s.섭_완료일
        FROM students s
        WHERE s.섭_완료일 BETWEEN $2 AND $3
          AND s.교사_고유번호 = $1

        UNION ALL

        /* 인도복 */
        SELECT
          s.이름,
          '인도복' AS 단계,
          s.복_완료일
        FROM students s
        WHERE s.복_완료일 BETWEEN $2 AND $3
          AND s.인도자_고유번호 = $1

        UNION ALL

        /* 교사복 */
        SELECT
          s.이름,
          '교사복' AS 단계,
          s.복_완료일
        FROM students s
        WHERE s.복_완료일 BETWEEN $2 AND $3
          AND s.교사_고유번호 = $1
      ) t
      ORDER BY 완료일;
    `;

        const { rows } = await client.query(query, [memberId, start, end]);
        return NextResponse.json(rows);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: '상세 조회 실패' }, { status: 500 });
    } finally {
        client.release();
    }
}
