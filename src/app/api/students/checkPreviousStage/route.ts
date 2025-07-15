import { NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import type { PoolClient } from 'pg';

async function getMemberUniqueId(client: PoolClient, 지역: string, 팀: string, 이름: string): Promise<string | null> {
    if (!지역?.trim() || !팀?.trim() || !이름?.trim()) return null;
    const prefix = 팀.trim().charAt(0);
    const query = `
        SELECT 고유번호 FROM members
        WHERE 지역 = $1 AND 구역 LIKE $2 AND 이름 = $3
        LIMIT 1
    `;
    const values = [지역.trim(), prefix + '%', 이름.trim()];
    const res = await client.query(query, values);
    return res.rows.length > 0 ? res.rows[0].고유번호 : null;
}

export async function GET(request: Request) {
    const client = await pool.connect();

    try {
        const { searchParams } = new URL(request.url);
        const name = searchParams.get('name')?.trim();
        const stage = searchParams.get('stage')?.trim()?.toUpperCase();

        const region = searchParams.get('region')?.trim();
        const team = searchParams.get('team')?.trim();
        const name2 = searchParams.get('name2')?.trim();

        const teacherRegion = searchParams.get('teacherRegion')?.trim();
        const teacherTeam = searchParams.get('teacherTeam')?.trim();
        const teacherName = searchParams.get('teacherName')?.trim();

        console.log(
            `[checkPreviousStage] name:${name}, stage:${stage}, region:${region}, team:${team}, name2:${name2}, teacherRegion:${teacherRegion}, teacherTeam:${teacherTeam}, teacherName:${teacherName}`
        );

        if (!name || !stage) {
            return NextResponse.json(
                { exists: false, message: 'Invalid parameters: name and stage are required.' },
                { status: 400 }
            );
        }

        let indUniqueId: string | null = null;
        let teaUniquId: string | null = null;

        if (stage === '탈락') {
            if (region && team && name2) {
                console.log('이거아님?1');
                indUniqueId = await getMemberUniqueId(client, region, team, name2);
            } else if (!indUniqueId && teacherRegion && teacherTeam && teacherName) {
                console.log('이거아님?2');
                teaUniquId = await getMemberUniqueId(client, teacherRegion, teacherTeam, teacherName);
            } else {
                indUniqueId = null;
                teaUniquId = null;
            }
        } else {
            if (region && team && name2) {
                indUniqueId = await getMemberUniqueId(client, region, team, name2);
            }
        }

        let result;
        if (indUniqueId) {
            result = await client.query(
                `SELECT COUNT(*) FROM students
                 WHERE 이름 = $1 AND UPPER(단계) = $2 AND COALESCE(CAST(인도자_고유번호 AS TEXT), '') = $3`,
                [name, stage, indUniqueId]
            );
        } else if (!indUniqueId && teaUniquId) {
            result = await client.query(
                `SELECT COUNT(*) FROM students
                 WHERE 이름 = $1 AND UPPER(단계) = $2 AND COALESCE(CAST(교사_고유번호 AS TEXT), '') = $3`,
                [name, stage, indUniqueId]
            );
        } else {
            result = await client.query(
                `SELECT COUNT(*) FROM students
                 WHERE 이름 = $1 AND UPPER(단계) = $2`,
                [name, stage]
            );
        }
        console.log(indUniqueId, teaUniquId);
        const count = parseInt(result.rows[0].count, 10);
        return NextResponse.json({ exists: count > 0 });
    } catch (error) {
        console.error('DB query error:', error);
        return NextResponse.json({ exists: false, message: 'DB error' }, { status: 500 });
    } finally {
        client.release();
    }
}
