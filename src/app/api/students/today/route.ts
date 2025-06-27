import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import dayjs from 'dayjs';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

export async function GET(req: NextRequest) {
    const client = await pool.connect();

    try {
        const { searchParams } = new URL(req.url);
        const startParam = searchParams.get('start');
        const endParam = searchParams.get('end');

        const today = dayjs();
        const start = startParam || today.startOf('day').format('YYYY-MM-DD');
        const end = endParam || today.endOf('day').format('YYYY-MM-DD');

        const result = await client.query(
            `
            SELECT 
                s.이름,
                s.단계,
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
                s.a_완료일 BETWEEN $1::date AND $2::date + INTERVAL '1 day' - INTERVAL '1 second'
                OR s.b_완료일 BETWEEN $1::date AND $2::date + INTERVAL '1 day' - INTERVAL '1 second'
                OR s.c_완료일 BETWEEN $1::date AND $2::date + INTERVAL '1 day' - INTERVAL '1 second'
                OR s.d_1_완료일 BETWEEN $1::date AND $2::date + INTERVAL '1 day' - INTERVAL '1 second'
                OR s.d_2_완료일 BETWEEN $1::date AND $2::date + INTERVAL '1 day' - INTERVAL '1 second'
                OR s.e_완료일 BETWEEN $1::date AND $2::date + INTERVAL '1 day' - INTERVAL '1 second'
                OR s.f_완료일 BETWEEN $1::date AND $2::date + INTERVAL '1 day' - INTERVAL '1 second'
                OR s.탈락 BETWEEN $1::date AND $2::date + INTERVAL '1 day' - INTERVAL '1 second'
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
