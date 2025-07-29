import { pool } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const client = await pool.connect();
    try {
        const { keys } = await req.json();
        if (!Array.isArray(keys) || keys.length === 0) {
            return NextResponse.json({ error: '삭제할 고유번호가 없습니다.' }, { status: 400 });
        }

        const deleteQuery = `
            UPDATE teachers
            SET fail = NULL,
                updated_at = NOW()
            WHERE uid = ANY($1)
        `;
        await client.query(deleteQuery, [keys]);

        const result = await client.query(
            `
            SELECT 
                m.고유번호, 
                m.이름, 
                m.지역, 
                m.구역, 
                t.reason,
                t.fail,
                t.type AS 교사형태,
                to_char(t.updated_at, 'YYYY-MM-DD HH24:MI:SS') AS "마지막업데이트"
            FROM teachers t
            JOIN members m ON m.고유번호 = t.uid
            ORDER BY t.uid
            `
        );

        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('삭제 오류:', error);
        return NextResponse.json({ error: '서버 오류로 삭제 실패' }, { status: 500 });
    } finally {
        client.release();
    }
}
