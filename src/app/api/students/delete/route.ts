// src/app/api/students/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';

export async function DELETE(req: NextRequest) {
    const client = await pool.connect();

    try {
        const body = await req.json();
        const { id, ids } = body;

        // 단일 삭제
        if (typeof id === 'number') {
            await client.query('DELETE FROM students WHERE id = $1', [id]);
            return NextResponse.json({ success: true, deleted: [id] });
        }

        // 복수 삭제
        if (Array.isArray(ids) && ids.every((i) => typeof i === 'number')) {
            await client.query(`DELETE FROM students WHERE id = ANY($1::int[])`, [ids]);
            return NextResponse.json({ success: true, deleted: ids });
        }

        return NextResponse.json({ error: 'Invalid id(s)' }, { status: 400 });
    } catch (error) {
        console.error('삭제 실패:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        client.release();
    }
}
