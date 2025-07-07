// src/app/api/login/route.ts
import { NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import { comparePassword, generateToken } from '@/app/lib/auth';

export async function POST(req: Request) {
    const { email, password } = await req.json();

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
        return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 401 });
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
        return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

    const token = generateToken(user.email);

    const response = NextResponse.json({ success: true });

    // Set token in HTTP-only cookie
    response.cookies.set('token', token, {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
}
