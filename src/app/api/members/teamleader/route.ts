import { pool } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
    const client = await pool.connect();
    try {
        const result = await client.query(`
      SELECT 지역, 팀, 팀장, 교관
      FROM team_leaders
      ORDER BY 지역, 팀::int
    `);
        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('/api/team-leaders GET error:', error);
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    } finally {
        client.release();
    }
}

export async function POST(request: NextRequest) {
    const client = await pool.connect();
    try {
        const teams: { 지역: string; 팀: string; 팀장: string; 교관: string }[] = await request.json();

        if (!Array.isArray(teams)) {
            return NextResponse.json({ error: '배열 형태로 요청해주세요.' }, { status: 400 });
        }

        await client.query('BEGIN');

        for (const team of teams) {
            await client.query(
                `
        INSERT INTO team_leaders (지역, 팀, 팀장, 교관, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (지역, 팀) DO UPDATE SET
          팀장 = EXCLUDED.팀장,
          교관 = EXCLUDED.교관,
          updated_at = NOW()
        `,
                [team.지역, team.팀, team.팀장, team.교관]
            );
        }

        await client.query('COMMIT');
        return NextResponse.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('/api/team-leader-update POST error:', error);
        return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
    } finally {
        client.release();
    }
}
