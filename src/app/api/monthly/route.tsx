import { pool } from '@/app/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
    const res = await pool.query('SELECT * FROM monthly ORDER BY month, region');
    return NextResponse.json(res.rows);
}
