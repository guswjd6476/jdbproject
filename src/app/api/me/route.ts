import { NextResponse, NextRequest } from 'next/server';
import { verifyToken } from '@/app/lib/auth';
import { getUserAuthInfo } from '@/app/lib/authUtils'; // 전역 함수 임포트

export async function GET(req: NextRequest) {
    const token = req.cookies.get('token')?.value;

    if (!token) {
        return NextResponse.json({ isLoggedIn: false });
    }

    try {
        const user = verifyToken(token);

        if (typeof user === 'object' && user !== null && 'email' in user) {
            const email = user.email as string;

            // 전역 유틸리티 함수를 호출하여 사용자의 권한 정보를 가져옵니다.
            const authInfo = getUserAuthInfo(email);

            // authInfo 객체를 기반으로 프론트엔드에 필요한 데이터를 구성합니다.
            const region = authInfo.region ?? 'all';

            // =================================================================
            //               ↓↓↓ 오류가 발생한 부분 수정 ↓↓↓
            // 'super'가 아니라 'superAdmin'으로 비교해야 합니다.
            // =================================================================
            const isTeamMode = authInfo.role !== 'superAdmin' && authInfo.role !== 'none';

            return NextResponse.json({
                isLoggedIn: true,
                email,
                role: authInfo.role, // 역할 정보
                region,
                isTeamMode,
            });
        }
    } catch {
        // 토큰 검증 실패
    }

    return NextResponse.json({ isLoggedIn: false });
}
