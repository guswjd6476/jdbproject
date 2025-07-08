import { NextResponse, NextRequest } from 'next/server';
import { verifyToken } from '@/app/lib/auth';

function getRegionFromEmail(email: string): string | 'all' {
    const lowered = email.toLowerCase();

    if (lowered.includes('nowon')) return '노원';
    if (lowered.includes('dobong')) return '도봉';
    if (lowered.includes('sungbook')) return '성북';
    if (lowered.includes('joongrang')) return '중랑';
    if (lowered.includes('gangbook')) return '강북';
    if (lowered.includes('dae')) return '대학';
    if (lowered.includes('sae')) return '새신자';

    return 'all';
}

export async function GET(req: NextRequest) {
    const token = req.cookies.get('token')?.value;

    if (!token) {
        return NextResponse.json({ isLoggedIn: false });
    }

    try {
        const user = verifyToken(token);

        if (typeof user === 'object' && user !== null && 'email' in user) {
            const email = user.email as string;

            const region = getRegionFromEmail(email);
            const isTeamMode = region !== 'all';

            return NextResponse.json({
                isLoggedIn: true,
                email,
                region,
                isTeamMode,
            });
        }
    } catch {
        // 토큰 검증 실패
    }

    return NextResponse.json({ isLoggedIn: false });
}
