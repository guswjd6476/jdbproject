import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';

export async function POST(req: NextRequest) {
    try {
        const { targets } = await req.json();
        console.log(targets, '?tartet');
        const client = await pool.connect();

        for (const t of targets) {
            const { 번호, month, date } = t;

            await client.query(
                `
                UPDATE students
                SET target = $1,
                    trydate = $2
                WHERE id = $3
            `,
                [month, date, 번호]
            );
        }

        client.release();
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('DB 업데이트 오류:', err);
        return NextResponse.json({ error: '서버 오류 발생' }, { status: 500 });
    }
}
