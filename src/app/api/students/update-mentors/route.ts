import { pool } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import type { PoolClient } from 'pg';

function extractTeamNumber(team: string): string {
    const match = team.trim().match(/^\d+/);
    return match ? match[0] : '';
}

// members 테이블에서 id 조회 (지역, 팀번호, 이름 기준)
async function getMemberUniqueId(client: PoolClient, 지역: string, 팀: string, 이름: string): Promise<number | null> {
    const teamNumber = extractTeamNumber(팀);
    if (!teamNumber) return null;

    try {
        const result = await client.query(
            `SELECT 고유번호 FROM members WHERE 지역 = $1 AND (구역 = $2 OR 구역 LIKE $3) AND 이름 = $4 LIMIT 1`,
            [지역, teamNumber, `${teamNumber}-%`, 이름]
        );

        return result.rows[0]?.고유번호 ?? null;
    } catch (err) {
        console.error('getMemberUniqueId error:', err);
        return null;
    }
}

export async function POST(req: NextRequest) {
    const client = await pool.connect();

    try {
        const body = await req.json();
        const { id, 단계, 인도자이름, 인도자지역, 인도자팀, 교사이름, 교사지역, 교사팀 } = body;

        // 필수 입력값 검사
        if (!id || !인도자이름 || !인도자지역 || !인도자팀) {
            return NextResponse.json({ success: false, message: '필수 정보 누락' }, { status: 400 });
        }

        const upperStep = (단계 ?? '').toUpperCase();
        const 교사필요 = !['A', 'B'].includes(upperStep);

        // 인도자 고유번호 조회
        const 인도자_고유번호 = await getMemberUniqueId(client, 인도자지역, 인도자팀, 인도자이름);
        if (!인도자_고유번호) {
            return NextResponse.json(
                { success: false, message: '인도자 정보가 members 테이블에 없습니다.' },
                { status: 400 }
            );
        }

        // 교사 고유번호 조회 (필요 시)
        let 교사_고유번호: number | null = null;
        if (교사필요) {
            if (!교사이름 || !교사지역 || !교사팀) {
                return NextResponse.json({ success: false, message: '교사 정보 누락' }, { status: 400 });
            }
            교사_고유번호 = await getMemberUniqueId(client, 교사지역, 교사팀, 교사이름);
            if (!교사_고유번호) {
                return NextResponse.json(
                    { success: false, message: '교사 정보가 members 테이블에 없습니다.' },
                    { status: 400 }
                );
            }
        }

        // 중복 방지 및 외래키 무결성 검사
        const memberCheck = await client.query(`SELECT 1 FROM members WHERE 고유번호 = $1`, [인도자_고유번호]);
        if (memberCheck.rowCount === 0) {
            return NextResponse.json(
                { success: false, message: '인도자 고유번호가 members에 없습니다.' },
                { status: 400 }
            );
        }

        // 트랜잭션 시작
        await client.query('BEGIN');

        // students 테이블 업데이트
        await client.query(`UPDATE students SET 인도자_고유번호 = $1, 교사_고유번호 = $2 WHERE id = $3`, [
            인도자_고유번호,
            교사필요 ? 교사_고유번호 : null,
            id,
        ]);

        await client.query('COMMIT');

        return NextResponse.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('멘토 업데이트 오류:', err);
        return NextResponse.json({ success: false, message: '서버 오류' }, { status: 500 });
    } finally {
        client.release();
    }
}
