import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region') ?? '';
    const team = searchParams.get('team') ?? '';
    const name = searchParams.get('name') ?? '';

    if (!region || !team || !name) {
        return NextResponse.json({ exists: false }, { status: 400 });
    }

    const client = await pool.connect();
    try {
        const teamNumberOnly = team.trim().match(/\d+/)?.[0] ?? '';
        if (!teamNumberOnly) {
            return NextResponse.json({ exists: false }, { status: 400 });
        }

        const res = await client.query(
            `SELECT 1 FROM members 
             WHERE 지역 = $1 AND 구역 LIKE $2 AND 이름 = $3 
             LIMIT 1`,
            [region, `${teamNumberOnly}-%`, name]
        );

        const exists = (res?.rowCount ?? 0) > 0;
        return NextResponse.json({ exists });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    } finally {
        client.release();
    }
}
