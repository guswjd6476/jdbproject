import { pool } from '@/app/lib/db';
import { NextResponse } from 'next/server';

// Request 인터페이스에서 conversionRates 제거
interface ConfigRequest {
    region: string;
    month: number;
    year: number;
    fGoals: Record<string, string>;
    weeklyPercentages: Record<string, Record<string, number>>;
}

export async function POST(request: Request) {
    let client;
    try {
        // conversionRates 제거
        const { region, month, year, fGoals, weeklyPercentages } = (await request.json()) as ConfigRequest;

        if (!region || !month || !year || !fGoals || !weeklyPercentages) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (month < 1 || month > 12) {
            return NextResponse.json({ error: 'Invalid month' }, { status: 400 });
        }

        client = await pool.connect();

        // conversion_rates 필드에 빈 JSON 객체 추가
        const result = await client.query(
            `
      INSERT INTO region_configs (
        region, month, year,
        예정_goals, weekly_percentages,
        conversion_rates, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (region, month, year)
      DO UPDATE SET
        예정_goals = EXCLUDED.예정_goals,
        weekly_percentages = EXCLUDED.weekly_percentages,
        conversion_rates = EXCLUDED.conversion_rates,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, created_at, updated_at;
    `,
            [
                region,
                month,
                year,
                JSON.stringify(fGoals),
                JSON.stringify(weeklyPercentages),
                JSON.stringify({}), // conversion_rates 빈 JSON 삽입
            ]
        );

        return NextResponse.json({ success: true, data: result.rows[0] }, { status: 200 });
    } catch (error) {
        console.error('Error saving config:', error);
        return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
    } finally {
        if (client) {
            client.release();
        }
    }
}

export async function GET(request: Request) {
    let client;
    try {
        const { searchParams } = new URL(request.url);
        const region = searchParams.get('region');
        const month = parseInt(searchParams.get('month') || '0');
        const year = parseInt(searchParams.get('year') || '0');

        if (!region || !month || !year || month < 1 || month > 12) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        client = await pool.connect();

        // conversion_rates도 SELECT에 포함할지 여부는 필요에 따라 선택 가능
        const result = await client.query(
            `
      SELECT 예정_goals, weekly_percentages
      FROM region_configs
      WHERE region = $1 AND month = $2 AND year = $3;
    `,
            [region, month, year]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ data: null }, { status: 200 });
        }

        return NextResponse.json({ data: result.rows[0] }, { status: 200 });
    } catch (error) {
        console.error('Error fetching config:', error);
        return NextResponse.json({ error: 'Failed to fetch configuration' }, { status: 500 });
    } finally {
        if (client) {
            client.release();
        }
    }
}
