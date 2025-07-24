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

        let result;

        if (stage === '탈락') {
            // 1. '탈락' 처리할 학생이 DB에 어떤 단계로든 등록된 적이 있는지 확인합니다.
            let existingStudentQuery;
            const queryParams = [name];

            let condition = '';
            if (indUniqueId && teaUniqueId) {
                condition = `(COALESCE(CAST(인도자_고유번호 AS TEXT), '') = $2 OR COALESCE(CAST(교사_고유번호 AS TEXT), '') = $3)`;
                queryParams.push(indUniqueId, teaUniqueId);
            } else if (indUniqueId) {
                condition = `COALESCE(CAST(인도자_고유번호 AS TEXT), '') = $2`;
                queryParams.push(indUniqueId);
            } else if (teaUniqueId) {
                condition = `COALESCE(CAST(교사_고유번호 AS TEXT), '') = $2`;
                queryParams.push(teaUniqueId);
            }

            if (condition) {
                existingStudentQuery = `SELECT COUNT(*) FROM students WHERE 이름 = $1 AND ${condition}`;
            } else {
                // 인도자/교사 정보가 모두 없는 경우 이름만으로 확인합니다.
                existingStudentQuery = `SELECT COUNT(*) FROM students WHERE 이름 = $1`;
            }

            const existingRes = await client.query(existingStudentQuery, queryParams);
            const existingCount = parseInt(existingRes.rows[0].count, 10);

            if (existingCount === 0) {
                // DB에 학생 기록이 전혀 없으면 '탈락' 처리할 수 없으므로 오류를 반환합니다.
                return NextResponse.json(
                    { exists: false, message: '탈락 처리할 기존 학생 기록이 없습니다.' },
                    { status: 400 }
                );
            }

            // 2. 학생 기록이 있다면, 이미 '탈락' 단계로 등록되어 있는지 확인하여 중복 저장을 방지합니다.
            const duplicateCheckParams = [name, '탈락'];
            if (condition) {
                result = await client.query(
                    `SELECT COUNT(*) FROM students WHERE 이름 = $1 AND UPPER(단계) = $2 AND ${condition}`,
                    [...queryParams.slice(0, 1), '탈락', ...queryParams.slice(1)]
                );
            } else {
                result = await client.query(
                    `SELECT COUNT(*) FROM students WHERE 이름 = $1 AND UPPER(단계) = $2`,
                    duplicateCheckParams
                );
            }
        } else {
            // '탈락'이 아닌 다른 단계의 존재 여부를 확인합니다.
            const queryParams = [name, stage];
            let condition = '';
            if (indUniqueId && teaUniqueId) {
                condition = `(COALESCE(CAST(인도자_고유번호 AS TEXT), '') = $3 OR COALESCE(CAST(교사_고유번호 AS TEXT), '') = $4)`;
                queryParams.push(indUniqueId, teaUniqueId);
            } else if (indUniqueId) {
                condition = `COALESCE(CAST(인도자_고유번호 AS TEXT), '') = $3`;
                queryParams.push(indUniqueId);
            } else if (teaUniqueId) {
                condition = `COALESCE(CAST(교사_고유번호 AS TEXT), '') = $3`;
                queryParams.push(teaUniqueId);
            }

            if (condition) {
                result = await client.query(
                    `SELECT COUNT(*) FROM students WHERE 이름 = $1 AND UPPER(단계) = $2 AND ${condition}`,
                    queryParams
                );
            } else {
                result = await client.query(`SELECT COUNT(*) FROM students WHERE 이름 = $1 AND UPPER(단계) = $2`, [
                    name,
                    stage,
                ]);
            }
        }

        const count = parseInt(result.rows[0].count, 10);
        return NextResponse.json({ exists: count > 0 });
    } catch (error) {
        console.error('DB query error:', error);
        return NextResponse.json({ exists: false, message: 'DB 오류가 발생했습니다.' }, { status: 500 });
    } finally {
        client.release();
    }
}
