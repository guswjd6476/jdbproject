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
    발: number;
    찾: number;
    합: number;
    섭: number;
    복: number;
    예정: number;
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
            const { month, region, 발 = 0, 찾 = 0, 합 = 0, 섭 = 0, 복 = 0, 예정 = 0, 센확 = 0, 센등 = 0 } = row;

            if (!month || !region) continue;

            const result = await pool.query(
                `
                INSERT INTO monthly (month, region, 발, 찾, 합, 섭, 복, 예정, "센확", "센등")
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (month, region)
                DO UPDATE SET
                    "발" = EXCLUDED.발,
                    "찾" = EXCLUDED.찾,
                    "합" = EXCLUDED.합,
                    "섭" = EXCLUDED.섭,
                    "복" = EXCLUDED.복,
                    "예정" = EXCLUDED.예정,
                    "센확" = EXCLUDED."센확",
                    "센등" = EXCLUDED."센등"
                RETURNING *;
                `,
                [month, region, 발, 찾, 합, 섭, 복, 예정, 센확, 센등]
            );

            results.push(result.rows[0]);
        }

        return NextResponse.json(results);
    } catch (error) {
        console.error('POST /api/monthly error:', error);
        return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
    }
}
