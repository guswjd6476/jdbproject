// src/app/api/students/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';

export async function DELETE(req: NextRequest) {
    const client = await pool.connect();

    try {
        const { id } = await req.json();

        if (typeof id !== 'number' || isNaN(id)) {
            return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
        }

        await client.query('DELETE FROM students WHERE id = $1', [id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('삭제 실패:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        client.release();
    }
}
