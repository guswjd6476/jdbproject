import { Pool } from 'pg';
import { NextResponse } from 'next/server';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: {
        rejectUnauthorized: false, // Required for Vercel Neon
    },
});

interface ConfigRequest {
    region: string;
    month: number;
    year: number;
    fGoals: Record<string, string>;
    conversionRates: Record<string, number>;
    weeklyPercentages: Record<string, Record<string, number>>;
}

export async function POST(request: Request) {
    let client;
    try {
        const { region, month, year, fGoals, conversionRates, weeklyPercentages } =
            (await request.json()) as ConfigRequest;

        // Validate input
        if (!region || !month || !year || !fGoals || !conversionRates || !weeklyPercentages) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        if (month < 1 || month > 12) {
            return NextResponse.json({ error: 'Invalid month' }, { status: 400 });
        }

        // Connect to the database
        client = await pool.connect();

        // Upsert configuration
        const result = await client.query(
            `
      INSERT INTO region_configs (region, month, year, f_goals, conversion_rates, weekly_percentages, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (region, month, year)
      DO UPDATE SET
        f_goals = EXCLUDED.f_goals,
        conversion_rates = EXCLUDED.conversion_rates,
        weekly_percentages = EXCLUDED.weekly_percentages,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, created_at, updated_at;
    `,
            [
                region,
                month,
                year,
                JSON.stringify(fGoals),
                JSON.stringify(conversionRates),
                JSON.stringify(weeklyPercentages),
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

        // Connect to the database
        client = await pool.connect();

        // Fetch configuration
        const result = await client.query(
            `
      SELECT f_goals, conversion_rates, weekly_percentages
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
