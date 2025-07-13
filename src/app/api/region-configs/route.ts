// src/app/api/region-configs/route.ts
import { NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';

export async function GET() {
    const client = await pool.connect();

    try {
        const result = await client.query(`
            SELECT id, region, month, year, f_goals
            FROM region_configs
        `);

        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('region_configs 가져오기 오류:', error);
        return NextResponse.json({ error: '데이터베이스 오류' }, { status: 500 });
    } finally {
        client.release();
    }
}
