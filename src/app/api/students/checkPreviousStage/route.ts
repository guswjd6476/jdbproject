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

        if (!name || !stage) {
            return NextResponse.json(
                { exists: false, message: '필수 파라미터(이름, 단계)가 누락되었습니다.' },
                { status: 400 }
            );
        }

        let indUniqueId: string | null = null;
        let teaUniqueId: string | null = null;

        if (region && team && name2) {
            indUniqueId = await getMemberUniqueId(client, region, team, name2);
        }
        if (teacherRegion && teacherTeam && teacherName) {
            teaUniqueId = await getMemberUniqueId(client, teacherRegion, teacherTeam, teacherName);
        }

        const hasInd = !!indUniqueId;
        const hasTea = !!teaUniqueId;
        let result;
        if (stage === '탈락') {
            let existsCount = 0;

            // 기존 기록 존재 확인
            if (hasInd && hasTea) {
                const res = await client.query(
                    `SELECT COUNT(*) FROM students 
                     WHERE 이름 = $1 AND 
                     (COALESCE(CAST(인도자_고유번호 AS TEXT), '') = $2 OR COALESCE(CAST(교사_고유번호 AS TEXT), '') = $3)`,
                    [name, indUniqueId, teaUniqueId]
                );
                existsCount = parseInt(res.rows[0].count, 10);
            } else if (hasInd) {
                const res = await client.query(
                    `SELECT COUNT(*) FROM students 
                     WHERE 이름 = $1 AND 
                     COALESCE(CAST(인도자_고유번호 AS TEXT), '') = $2`,
                    [name, indUniqueId]
                );
                existsCount = parseInt(res.rows[0].count, 10);
            } else if (hasTea) {
                const res = await client.query(
                    `SELECT COUNT(*) FROM students 
                     WHERE 이름 = $1 AND 
                     COALESCE(CAST(교사_고유번호 AS TEXT), '') = $2`,
                    [name, teaUniqueId]
                );
                existsCount = parseInt(res.rows[0].count, 10);
            } else {
                const res = await client.query(`SELECT COUNT(*) FROM students WHERE 이름 = $1`, [name]);
                existsCount = parseInt(res.rows[0].count, 10);
            }

            if (existsCount === 0) {
                return NextResponse.json(
                    { exists: false, message: '탈락 처리할 기존 학생 기록이 없습니다.' },
                    { status: 400 }
                );
            }

            // 탈락 중복 확인
            if (hasInd && hasTea) {
                const res = await client.query(
                    `SELECT COUNT(*) FROM students 
                     WHERE 이름 = $1 AND UPPER(단계) = $2 AND 
                     (COALESCE(CAST(인도자_고유번호 AS TEXT), '') = $3 OR COALESCE(CAST(교사_고유번호 AS TEXT), '') = $4)`,
                    [name, '탈락', indUniqueId, teaUniqueId]
                );
                return NextResponse.json({ exists: parseInt(res.rows[0].count, 10) > 0 });
            } else if (hasInd) {
                const res = await client.query(
                    `SELECT COUNT(*) FROM students 
                     WHERE 이름 = $1 AND UPPER(단계) = $2 AND 
                     COALESCE(CAST(인도자_고유번호 AS TEXT), '') = $3`,
                    [name, '탈락', indUniqueId]
                );
                return NextResponse.json({ exists: parseInt(res.rows[0].count, 10) > 0 });
            } else if (hasTea) {
                const res = await client.query(
                    `SELECT COUNT(*) FROM students 
                     WHERE 이름 = $1 AND UPPER(단계) = $2 AND 
                     COALESCE(CAST(교사_고유번호 AS TEXT), '') = $3`,
                    [name, '탈락', teaUniqueId]
                );
                return NextResponse.json({ exists: parseInt(res.rows[0].count, 10) > 0 });
            } else {
                const res = await client.query(
                    `SELECT COUNT(*) FROM students 
                     WHERE 이름 = $1 AND UPPER(단계) = $2`,
                    [name, '탈락']
                );
                return NextResponse.json({ exists: parseInt(res.rows[0].count, 10) > 0 });
            }
        }

        // 탈락이 아닌 단계 중복 확인
        if (hasInd && hasTea) {
            result = await client.query(
                `SELECT COUNT(*) FROM students 
                 WHERE 이름 = $1 AND UPPER(단계) = $2 AND 
                 (COALESCE(CAST(인도자_고유번호 AS TEXT), '') = $3 OR COALESCE(CAST(교사_고유번호 AS TEXT), '') = $4)`,
                [name, stage, indUniqueId, teaUniqueId]
            );
        } else if (hasInd) {
            result = await client.query(
                `SELECT COUNT(*) FROM students 
                 WHERE 이름 = $1 AND UPPER(단계) = $2 AND 
                 COALESCE(CAST(인도자_고유번호 AS TEXT), '') = $3`,
                [name, stage, indUniqueId]
            );
        } else if (hasTea) {
            result = await client.query(
                `SELECT COUNT(*) FROM students 
                 WHERE 이름 = $1 AND UPPER(단계) = $2 AND 
                 COALESCE(CAST(교사_고유번호 AS TEXT), '') = $3`,
                [name, stage, teaUniqueId]
            );
        } else {
            result = await client.query(`SELECT COUNT(*) FROM students WHERE 이름 = $1 AND UPPER(단계) = $2`, [
                name,
                stage,
            ]);
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
