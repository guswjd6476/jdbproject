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
        const stageRaw = searchParams.get('stage')?.trim();
        if (!name || !stageRaw) {
            return NextResponse.json(
                { exists: false, message: '필수 파라미터(이름, 단계)가 누락되었습니다.' },
                { status: 400 }
            );
        }

        // 탈락은 대문자 변환 하지 않고 그대로 비교할 예정
        const stage = stageRaw.toUpperCase() === '탈락' ? '탈락' : stageRaw.toUpperCase();

        const region = searchParams.get('region')?.trim();
        const team = searchParams.get('team')?.trim();
        const name2 = searchParams.get('name2')?.trim();

        const teacherRegion = searchParams.get('teacherRegion')?.trim();
        const teacherTeam = searchParams.get('teacherTeam')?.trim();
        const teacherName = searchParams.get('teacherName')?.trim();

        const indUniqueId = region && team && name2 ? await getMemberUniqueId(client, region, team, name2) : null;
        const teaUniqueId =
            teacherRegion && teacherTeam && teacherName
                ? await getMemberUniqueId(client, teacherRegion, teacherTeam, teacherName)
                : null;

        if (stage === '탈락') {
            // 기존 수강 기록 존재 여부 (고유번호가 없거나 조건이 맞지 않아도 찾아야 하므로 조건 완화)
            const existingStudentQuery = `
                SELECT COUNT(*) FROM students
                WHERE 이름 = $1
                AND (
                    COALESCE(CAST(인도자_고유번호 AS TEXT), '') = $2
                    OR COALESCE(CAST(교사_고유번호 AS TEXT), '') = $3
                    OR (COALESCE(CAST(인도자_고유번호 AS TEXT), '') = '' AND COALESCE(CAST(교사_고유번호 AS TEXT), '') = '')
                )
            `;
            const existingParams = [name, indUniqueId || '', teaUniqueId || ''];
            const existingRes = await client.query(existingStudentQuery, existingParams);
            const existingCount = parseInt(existingRes.rows[0].count, 10);

            // 이미 탈락 처리된 건 존재 여부 체크
            // 조건도 위와 동일하게 완화
            const droppedQuery = `
                SELECT COUNT(*) FROM students
                WHERE 이름 = $1
                  AND UPPER(단계) = $2
                  AND (
                      COALESCE(CAST(인도자_고유번호 AS TEXT), '') = $3
                      OR COALESCE(CAST(교사_고유번호 AS TEXT), '') = $4
                      OR (COALESCE(CAST(인도자_고유번호 AS TEXT), '') = '' AND COALESCE(CAST(교사_고유번호 AS TEXT), '') = '')
                  )
            `;
            const droppedParams = [name, '탈락', indUniqueId || '', teaUniqueId || ''];
            const droppedRes = await client.query(droppedQuery, droppedParams);
            const droppedCount = parseInt(droppedRes.rows[0].count, 10);

            return NextResponse.json({
                exists: existingCount > 0,
                alreadyDropped: droppedCount > 0,
            });
        }

        // 일반 단계 조회 (탈락 이외)
        {
            const queryParams2: any[] = [name, stage];
            let condition2 = '';
            if (indUniqueId && teaUniqueId) {
                condition2 = `(COALESCE(CAST(인도자_고유번호 AS TEXT), '') = $3 OR COALESCE(CAST(교사_고유번호 AS TEXT), '') = $4)`;
                queryParams2.push(indUniqueId, teaUniqueId);
            } else if (indUniqueId) {
                condition2 = `COALESCE(CAST(인도자_고유번호 AS TEXT), '') = $3`;
                queryParams2.push(indUniqueId);
            } else if (teaUniqueId) {
                condition2 = `COALESCE(CAST(교사_고유번호 AS TEXT), '') = $3`;
                queryParams2.push(teaUniqueId);
            }

            const stageQuery = condition2
                ? `SELECT COUNT(*) FROM students WHERE 이름 = $1 AND UPPER(단계) = $2 AND ${condition2}`
                : `SELECT COUNT(*) FROM students WHERE 이름 = $1 AND UPPER(단계) = $2`;

            const res = await client.query(stageQuery, queryParams2);
            const count = parseInt(res.rows[0].count, 10);
            return NextResponse.json({ exists: count > 0 });
        }
    } catch (e) {
        console.error('DB query error:', e);
        return NextResponse.json({ exists: false, message: 'DB 오류가 발생했습니다.' }, { status: 500 });
    } finally {
        client.release();
    }
}
