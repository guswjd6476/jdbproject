import { NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import { PoolClient } from 'pg';

async function getMemberUniqueId(client: PoolClient, 지역: string, 팀: string, 이름: string): Promise<string | null> {
    if (!지역 || !팀 || !이름) return null;
    const prefix = 팀.charAt(0);
    const query = `
		SELECT 고유번호 FROM members
		WHERE 지역 = $1 AND 구역 LIKE $2 AND 이름 = $3
		LIMIT 1
	`;
    const values = [지역, prefix + '%', 이름];
    const res = await client.query(query, values);
    return res.rows.length > 0 ? res.rows[0].고유번호 : null;
}

export async function GET(request: Request) {
    const client = await pool.connect();
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name')?.trim();
    const region = searchParams.get('region')?.trim().toUpperCase();
    const team = searchParams.get('team')?.trim();
    const name2 = searchParams.get('name2')?.trim();
    const stage = searchParams.get('stage')?.trim();

    if (!name || !stage) {
        return NextResponse.json(
            { exists: false, message: 'Invalid parameters: name and stage are required.' },
            { status: 400 }
        );
    }

    let indUniqueId;
    if (region && team && name2) {
        indUniqueId = await getMemberUniqueId(client, region, team, name2);
    }

    if (!indUniqueId) {
        return NextResponse.json({ exists: false, message: '인도자 고유번호를 찾을 수 없습니다.' }, { status: 400 });
    }

    try {
        const result = await pool.query(
            `SELECT COUNT(*) FROM students
       WHERE 이름 = $1 AND UPPER(단계) = $2 AND COALESCE(CAST(인도자_고유번호 AS TEXT), '') = $3`,
            [name, stage, indUniqueId]
        );
        const count = parseInt(result.rows[0].count, 10);
        return NextResponse.json({ exists: count > 0 });
    } catch (error) {
        console.error('DB query error:', error);
        return NextResponse.json({ exists: false, message: 'DB error' }, { status: 500 });
    }
}
