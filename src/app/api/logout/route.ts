// src/app/api/logout/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
    const response = NextResponse.json({ success: true });

    // 쿠키 제거
    response.cookies.set('token', '', {
        httpOnly: true,
        path: '/',
        maxAge: 0,
    });

    return response;
}
