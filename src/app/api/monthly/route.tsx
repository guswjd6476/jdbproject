import { pool } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// 🔍 전체 데이터 조회
export async function GET() {
    try {
        const res = await pool.query('SELECT * FROM monthly ORDER BY month, region');
        return NextResponse.json(res.rows);
    } catch (error) {
        console.error('GET /api/monthly error:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}

// ✏️ 추가 or 수정 (UPSERT)
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { month, region, team = '', a = 0, b = 0, c = 0, d_1 = 0, d_2 = 0, f = 0 } = body;

        if (!month || !region) {
            return NextResponse.json({ error: 'month and region are required' }, { status: 400 });
        }

        const result = await pool.query(
            `
            INSERT INTO monthly (month, region, team, a, b, c, d_1, d_2, f)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (month, region, team)
            DO UPDATE SET
                a = EXCLUDED.a,
                b = EXCLUDED.b,
                c = EXCLUDED.c,
                d_1 = EXCLUDED.d_1,
                d_2 = EXCLUDED.d_2,
                f = EXCLUDED.f
            RETURNING *;
            `,
            [month, region, team, a, b, c, d_1, d_2, f]
        );

        return NextResponse.json(result.rows[0]);
    } catch (error) {
        console.error('POST /api/monthly error:', error);
        return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
    }
}
