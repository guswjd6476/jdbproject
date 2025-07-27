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
type RowData = {
    month: string;
    region: string;
    a: number;
    b: number;
    c: number;
    d_1: number;
    d_2: number;
    e: number;
    f: number;
    센확: number;
    센등: number;
};

export async function POST(req: NextRequest) {
    try {
        const rows: RowData[] = await req.json();

        // 유효성 검사
        if (!Array.isArray(rows) || rows.length === 0) {
            return NextResponse.json({ error: 'No data provided' }, { status: 400 });
        }

        const results = [];

        for (const row of rows) {
            const { month, region, a = 0, b = 0, c = 0, d_1 = 0, d_2 = 0, f = 0, 센확 = 0, 센등 = 0 } = row;

            if (!month || !region) continue;

            const result = await pool.query(
                `
                INSERT INTO monthly (month, region, a, b, c, d_1, d_2, f, "센확", "센등")
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (month, region)
                DO UPDATE SET
                    a = EXCLUDED.a,
                    b = EXCLUDED.b,
                    c = EXCLUDED.c,
                    d_1 = EXCLUDED.d_1,
                    d_2 = EXCLUDED.d_2,
                    f = EXCLUDED.f,
                    "센확" = EXCLUDED."센확",
                    "센등" = EXCLUDED."센등"
                RETURNING *;
                `,
                [month, region, a, b, c, d_1, d_2, f, 센확, 센등]
            );

            results.push(result.rows[0]);
        }

        return NextResponse.json(results);
    } catch (error) {
        console.error('POST /api/monthly error:', error);
        return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
    }
}
