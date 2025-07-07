import { NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import { hashPassword } from '@/app/lib/auth';

export async function POST(req: Request) {
    const { email, password } = await req.json();
    const hashed = await hashPassword(password);

    try {
        await pool.query('INSERT INTO users (email, password) VALUES ($1, $2)', [email, hashed]);
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: '이미 등록된 이메일입니다.' }, { status: 400 });
    }
}
