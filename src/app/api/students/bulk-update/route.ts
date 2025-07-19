import { pool } from '@/app/lib/db';
import { NextResponse } from 'next/server';

const ALLOWED_FIELDS = new Set([
    'a_완료일',
    'b_완료일',
    'c_완료일',
    'd_1_완료일',
    'd_2_완료일',
    'e_완료일',
    'f_완료일',
    '센확_완료일',
    '탈락',
]);

export async function POST(request: Request) {
    const body = await request.json();

    const { ids, 단계, 완료일필드, 완료일 } = body;

    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'ids 필수' }, { status: 400 });

    if (완료일필드 && !ALLOWED_FIELDS.has(완료일필드)) {
        return NextResponse.json({ error: '허용되지 않은 완료일 필드입니다.' }, { status: 400 });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        if (단계) {
            await client.query(`UPDATE students SET 단계 = $1 WHERE id = ANY($2::int[])`, [단계, ids]);
        }

        if (완료일필드 && 완료일) {
            await client.query(`UPDATE students SET ${완료일필드} = $1 WHERE id = ANY($2::int[])`, [완료일, ids]);
        }

        await client.query('COMMIT');
        return NextResponse.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        return NextResponse.json({ error: '서버 에러' }, { status: 500 });
    } finally {
        client.release();
    }
}
