import { pool } from '@/app/lib/db';
import { Student } from '@/app/lib/types';
import { NextRequest, NextResponse } from 'next/server';
import { PoolClient } from 'pg';
import { verifyToken } from '@/app/lib/auth'; // 토큰 검증 함수 import
import type { JwtPayload } from 'jsonwebtoken';

const 단계순서 = ['A', 'B', 'C', 'D-1', 'D-2', 'E', 'F'];

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

const 단계완료일컬럼: Record<string, string> = {
    A: 'a_완료일',
    B: 'b_완료일',
    C: 'c_완료일',
    'D-1': 'd_1_완료일',
    'D-2': 'd_2_완료일',
    E: 'e_완료일',
    F: 'f_완료일',
};

export async function GET(request: NextRequest) {
    const client = await pool.connect();
    try {
        const token = request.cookies.get('token')?.value;
        let userEmail = '';
        if (token) {
            try {
                const user = verifyToken(token);
                if (typeof user === 'object' && user !== null && 'email' in user) {
                    userEmail = (user as JwtPayload).email ?? '';
                }
            } catch {
                // 토큰 검증 실패시 그냥 전체 조회 (또는 401 리턴도 가능)
                userEmail = '';
            }
        }

        const search = request.nextUrl.searchParams.get('q')?.trim();

        let baseQuery = `
            SELECT 
                s.id AS 번호, 
                s.단계, 
                s.이름, 
                s.연락처, 
                s.생년월일,
                s.a_완료일 AS "a",
                s.b_완료일 AS "b",
                s.c_완료일 AS "c",
                s.d_1_완료일 AS "d-1",
                s.d_2_완료일 AS "d-2",
                s.e_완료일 AS "e",
                s.f_완료일 AS "f",
                s.탈락 AS "g",
                m_ind.지역 AS 인도자지역, 
                m_ind.구역 AS 인도자팀, 
                m_ind.이름 AS 인도자이름,
                m_tch.지역 AS 교사지역, 
                m_tch.구역 AS 교사팀, 
                m_tch.이름 AS 교사이름
            FROM students s
            LEFT JOIN members m_ind ON s.인도자_고유번호 = m_ind.고유번호
            LEFT JOIN members m_tch ON s.교사_고유번호 = m_tch.고유번호
        `;

        const values: string[] = [];
        const whereConditions: string[] = [];

        if (search) {
            whereConditions.push(`(
                s.이름 ILIKE $${values.length + 1} OR
                m_ind.이름 ILIKE $${values.length + 1} OR
                m_tch.이름 ILIKE $${values.length + 1} OR
                m_ind.지역 ILIKE $${values.length + 1} OR
                m_tch.지역 ILIKE $${values.length + 1} OR
                m_ind.구역 ILIKE $${values.length + 1} OR
                m_tch.구역 ILIKE $${values.length + 1}
            )`);
            values.push(`%${search}%`);
        }

        // userEmail에 따른 지역 필터링
        if (userEmail === 'nowon@nowon.com') {
            whereConditions.push(`(m_ind.지역 = '노원' OR m_tch.지역 = '노원')`);
        } else if (userEmail === 'dobong@dobong.com') {
            whereConditions.push(`(m_ind.지역 = '도봉' OR m_tch.지역 = '도봉')`);
        }
        // jdb@jdb.com은 필터 없음

        if (whereConditions.length > 0) {
            baseQuery += ' WHERE ' + whereConditions.join(' AND ');
        }

        baseQuery += ' ORDER BY s.id ASC';

        const res = await client.query(baseQuery, values);

        return NextResponse.json(res.rows);
    } catch (err: unknown) {
        console.error('GET /api/students 에러:', err);
        const message = err instanceof Error ? err.message : '데이터 조회 실패';
        return NextResponse.json({ error: message }, { status: 500 });
    } finally {
        client.release();
    }
}
export async function POST(request: NextRequest) {
    const client = await pool.connect();
    try {
        const data: Student[] = await request.json();
        const now = new Date();

        for (const row of data) {
            row.단계 = row.단계.trim().toUpperCase();
            row.인도자_고유번호 = await getMemberUniqueId(client, row.인도자지역, row.인도자팀, row.인도자이름);

            if (row.단계 === 'a' || row.단계 === 'b') {
                row.교사_고유번호 = null;
            } else {
                row.교사_고유번호 = await getMemberUniqueId(client, row.교사지역, row.교사팀, row.교사이름);
            }

            const 완료일: { [key: string]: Date | null } = {
                a_완료일: null,
                b_완료일: null,
                c_완료일: null,
                d_1_완료일: null,
                d_2_완료일: null,
                e_완료일: null,
                f_완료일: null,
            };
            const colName = 단계완료일컬럼[row.단계];
            if (colName) 완료일[colName] = now;

            const existingRes = await client.query('SELECT * FROM students WHERE 이름 = $1 ORDER BY 단계 ASC', [
                row.이름.trim(),
            ]);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const existing = existingRes.rows.find((r) => 단계순서.indexOf(r.단계) < 단계순서.indexOf(row.단계));

            if (existing) {
                await client.query(
                    `UPDATE students SET
                        단계 = $1,
                        연락처 = COALESCE($2, 연락처),
                        생년월일 = COALESCE($3, 생년월일),
                        인도자_고유번호 = COALESCE($4, 인도자_고유번호),
                        교사_고유번호 = COALESCE($5, 교사_고유번호),
                        a_완료일 = COALESCE($6, a_완료일),
                        b_완료일 = COALESCE($7, b_완료일),
                        c_완료일 = COALESCE($8, c_완료일),
                        d_1_완료일 = COALESCE($9, d_1_완료일),
                        d_2_완료일 = COALESCE($10, d_2_완료일),
                        e_완료일 = COALESCE($11, e_완료일),
                        f_완료일 = COALESCE($12, f_완료일)
                    WHERE id = $13`,
                    [
                        row.단계,
                        row.연락처 || existing.연락처,
                        row.생년월일 || existing.생년월일,
                        row.인도자_고유번호 || existing.인도자_고유번호,
                        row.교사_고유번호 || existing.교사_고유번호,
                        완료일.a_완료일,
                        완료일.b_완료일,
                        완료일.c_완료일,
                        완료일.d_1_완료일,
                        완료일.d_2_완료일,
                        완료일.e_완료일,
                        완료일.f_완료일,
                        existing.id,
                    ]
                );
            } else {
                await client.query(
                    `INSERT INTO students
                        (단계, 이름, 연락처, 생년월일, 인도자_고유번호, 교사_고유번호,
                         a_완료일, b_완료일, c_완료일, d_1_완료일, d_2_완료일, e_완료일, f_완료일)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                    [
                        row.단계,
                        row.이름,
                        row.연락처,
                        row.생년월일,
                        row.인도자_고유번호,
                        row.교사_고유번호,
                        완료일.a_완료일,
                        완료일.b_완료일,
                        완료일.c_완료일,
                        완료일.d_1_완료일,
                        완료일.d_2_완료일,
                        완료일.e_완료일,
                        완료일.f_완료일,
                    ]
                );
            }
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        console.error('POST /api/students 에러:', err);
        const message = err instanceof Error ? err.message : '서버 오류가 발생했습니다.';
        return NextResponse.json({ success: false, message }, { status: 500 });
    } finally {
        client.release();
    }
}
