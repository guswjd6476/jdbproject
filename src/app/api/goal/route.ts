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

// ✅ 추가된 비즈니스 로직: 지역 및 홀/짝수 달에 따른 목표 점수 계산
const getRegionTargetPoints = (region: string, month: number): number => {
    const isEvenMonth = month % 2 === 0;
    const groupA = ['도봉', '성북', '노원', '중랑', '강북'];

    // 1. 도봉, 성북, 노원, 중랑, 강북 (짝수: 5점 / 홀수: 2점)
    if (groupA.includes(region)) {
        return isEvenMonth ? 5 : 2;
    }
    // 2. 대학 (짝수: 2점 / 홀수: 15점)
    if (region === '대학') {
        return isEvenMonth ? 2 : 15;
    }
    // 3. 새신자 (고정 3점)
    if (region === '새신자') {
        return 3;
    }
    // 4. 이음 (고정 1점)
    if (region === '이음') {
        return 1;
    }

    return 0; // 예외/기본값 처리
};

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as ConfigRequest;
        const { region, month, year, fGoals, weeklyPercentages, goalMultipliers } = body;

        // Validation
        if (!region || !month || !year || !fGoals || !weeklyPercentages) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        if (month < 1 || month > 12) {
            return NextResponse.json({ error: 'Invalid month' }, { status: 400 });
        }

        // ✅ 단일 쿼리는 pool.query()로 실행 (자동으로 커넥션을 가져오고 반환함)
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
            region,
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
        const region = searchParams.get('region');
        const month = parseInt(searchParams.get('month') || '0', 10);
        const year = parseInt(searchParams.get('year') || '0', 10);

        // Validation
        if (!region || !month || !year || month < 1 || month > 12) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        // ✅ 단일 쿼리 실행
        const query = `
            SELECT 예정_goals, weekly_percentages, conversion_rates
            FROM region_configs
            WHERE region = $1 AND month = $2 AND year = $3;
        `;

        const result = await pool.query(query, [region, month, year]);

        // 데이터가 없으면 null 반환
        const data = result.rows.length > 0 ? result.rows[0] : null;

        // ✅ 프론트엔드에서 계산된 기준 점수를 바로 쓸 수 있도록 타겟 포인트 추가 반환
        const targetPoints = getRegionTargetPoints(region, month);

        return NextResponse.json(
            {
                data,
                targetPoints,
            },
            { status: 200 },
        );
    } catch (error) {
        console.error('Error fetching config:', error);
        return NextResponse.json({ error: 'Failed to fetch configuration' }, { status: 500 });
    }
}
