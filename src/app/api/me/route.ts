import { NextResponse, NextRequest } from 'next/server';
import { verifyToken } from '@/app/lib/auth';

export async function GET(req: NextRequest) {
    const token = req.cookies.get('token')?.value;

    if (!token) {
        return NextResponse.json({ isLoggedIn: false });
    }

    try {
        const user = verifyToken(token);
        if (user) {
            return NextResponse.json({ isLoggedIn: true });
        }
    } catch {
        // 토큰 검증 실패
    }

    return NextResponse.json({ isLoggedIn: false });
}
