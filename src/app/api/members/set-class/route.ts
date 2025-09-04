import { NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';

// 멤버 전체 조회
export async function GET() {
    const client = await pool.connect();
    try {
        const query = `
      SELECT 고유번호, 이름, 지역, 구역, ban
      FROM members
      ORDER BY 이름
    `;
        const { rows } = await client.query(query);
        return NextResponse.json(rows);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    } finally {
        client.release();
    }
}

export async function POST(req: Request) {
    const client = await pool.connect();
    try {
        const body = await req.json();
        const updates = Array.isArray(body) ? body : [body];

        const results = [];
        for (const { 고유번호, 이름, 지역, 구역, ban } of updates) {
            const query = `
                INSERT INTO members (고유번호, 이름, 지역, 구역, ban, updated_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT (고유번호)
                DO UPDATE SET
                    ban = EXCLUDED.ban,
                    updated_at = NOW()
                RETURNING 고유번호, 이름, 지역, 구역, ban
            `;
            const { rows } = await client.query(query, [
                고유번호,
                이름 ?? null,
                지역 ?? null,
                구역 ?? null,
                ban ?? null,
            ]);
            if (rows[0]) results.push(rows[0]);
        }

        return NextResponse.json(results);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: '업데이트 실패' }, { status: 500 });
    } finally {
        client.release();
    }
}
