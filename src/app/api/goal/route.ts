import { pool } from '@/app/lib/db';
import { NextResponse } from 'next/server';

interface ConfigRequest {
    region: string;
    month: number;
    year: number;
    fGoals: Record<string, string>;
    weeklyPercentages: Record<string, Record<string, number>>;
    goalMultipliers: Record<string, Record<string, number>>;
}

const getRegionTargetPoints = (region: string, month: number): number => {
    const isEvenMonth = month % 2 === 0;
    const groupA = ['도봉', '성북', '노원', '중랑', '강북'];

    if (groupA.includes(region)) return isEvenMonth ? 5 : 2;
    if (region === '대학') return isEvenMonth ? 2 : 15;
    if (region === '새신자') return 3;
    if (region === '이음') return 1;

    return 0;
};

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as ConfigRequest;
        const { region, month, year, fGoals, weeklyPercentages, goalMultipliers } = body;

        // ✅ 런타임 데이터 형식 검증 강화
        if (!region || !month || !year || !fGoals || !weeklyPercentages || !goalMultipliers) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        if (typeof fGoals !== 'object' || typeof weeklyPercentages !== 'object') {
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }
        if (month < 1 || month > 12) {
            return NextResponse.json({ error: 'Invalid month' }, { status: 400 });
        }

        const query = `
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
        `;

        const values = [
            region.trim(),
            month,
            year,
            JSON.stringify(fGoals),
            JSON.stringify(weeklyPercentages),
            JSON.stringify(goalMultipliers),
        ];

        const result = await pool.query(query, values);
        return NextResponse.json({ success: true, data: result.rows[0] }, { status: 200 });
    } catch (error) {
        console.error('Error saving config:', error);
        return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        // ✅ 한글 깨짐 및 공백 방지를 위한 디코딩 및 trim 처리
        const region = decodeURIComponent(searchParams.get('region') || '').trim();
        const month = parseInt(searchParams.get('month') || '0', 10);
        const year = parseInt(searchParams.get('year') || '0', 10);

        if (!region || !month || !year || month < 1 || month > 12) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        const query = `
            SELECT 예정_goals, weekly_percentages, conversion_rates
            FROM region_configs
            WHERE region = $1 AND month = $2 AND year = $3;
        `;

        const result = await pool.query(query, [region, month, year]);
        const data = result.rows.length > 0 ? result.rows[0] : null;
        const targetPoints = getRegionTargetPoints(region, month);

        return NextResponse.json({ data, targetPoints }, { status: 200 });
    } catch (error) {
        console.error('Error fetching config:', error);
        return NextResponse.json({ error: 'Failed to fetch configuration' }, { status: 500 });
    }
}
