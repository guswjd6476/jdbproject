import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';

export async function POST(req: NextRequest) {
    const client = await pool.connect();

    try {
        const { 고유번호, 사유 } = await req.json();

        if (!고유번호 || !사유) {
            return NextResponse.json({ error: '고유번호와 사유는 필수입니다.' }, { status: 400 });
        }
        console.log(사유, 고유번호);
        await client.query(
            `
            UPDATE teachers
            SET fail=true,
                reason = $1,
                updated_at = NOW()
            WHERE uid = $2
        `,
            [사유, 고유번호]
        );

        const result = await client.query(`SELECT * FROM teachers ORDER BY updated_at DESC`);
        return NextResponse.json(result.rows);
    } catch (err) {
        console.error('탈락 처리 오류:', err);
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    } finally {
        client.release();
    }
}
