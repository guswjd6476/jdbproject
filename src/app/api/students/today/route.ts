import { NextRequest, NextResponse } from 'next/server';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { pool } from '@/app/lib/db';

dayjs.extend(utc);
dayjs.extend(timezone);

export async function GET(req: NextRequest) {
    const client = await pool.connect();

    try {
        const { searchParams } = new URL(req.url);
        const startParam = searchParams.get('start');
        const endParam = searchParams.get('end');

        // 한국시간(Asia/Seoul) 기준으로 오늘 날짜 처리
        const today = dayjs().tz('Asia/Seoul');
        const start = startParam || today.startOf('day').format('YYYY-MM-DD');
        const end = endParam || today.endOf('day').format('YYYY-MM-DD');

        const result = await client.query(
            `
            SELECT 
                s.id,
                s.이름,
                s.단계,
                s.발_완료일,
                s.찾_완료일,
                s.합_완료일,
                s.섭_완료일,
                s.복_완료일,
                s.예정_완료일,
                s.센확_완료일,
                s.탈락,
                m1.지역 AS 인도자지역,
                m1.구역 AS 인도자구역,
                m1.이름 AS 인도자이름,
                m2.지역 AS 교사지역,
                m2.구역 AS 교사구역,
                m2.이름 AS 교사이름
            FROM students s
            LEFT JOIN members m1 ON s.인도자_고유번호 = m1.고유번호
            LEFT JOIN members m2 ON s.교사_고유번호 = m2.고유번호
            WHERE (
                (s.발_완료일 >= $1::date AND s.발_완료일 < ($2::date + INTERVAL '1 day'))
                OR (s.찾_완료일 >= $1::date AND s.찾_완료일 < ($2::date + INTERVAL '1 day'))
                OR (s.합_완료일 >= $1::date AND s.합_완료일 < ($2::date + INTERVAL '1 day'))
                OR (s.섭_완료일 >= $1::date AND s.섭_완료일 < ($2::date + INTERVAL '1 day'))
                OR (s.복_완료일 >= $1::date AND s.복_완료일 < ($2::date + INTERVAL '1 day'))
                OR (s.예정_완료일 >= $1::date AND s.예정_완료일 < ($2::date + INTERVAL '1 day'))
                OR (s.센확_완료일 >= $1::date AND s.센확_완료일 < ($2::date + INTERVAL '1 day'))
                OR (s.탈락 >= $1::date AND s.탈락 < ($2::date + INTERVAL '1 day'))
            )
            ORDER BY s.id DESC
            `,
            [start, end]
        );

        return NextResponse.json(result.rows);
    } catch (err) {
        console.error('명단 조회 실패:', err);
        return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 });
    } finally {
        client.release();
    }
}
