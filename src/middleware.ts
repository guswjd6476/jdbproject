import { NextRequest, NextResponse } from 'next/server';

// [항상] 조직명이나 용어가 노출되지 않는 중립적 경로명 관리 (S12)
// 인증 없이 '누구나' 접근 가능한 최소한의 공공 경로만 지정합니다.
const ALLOWED_PUBLIC_PATHS = ['/login', '/favicon.ico'];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // [항상] 안전한 방식으로 쿠키 토큰 추출 (S1)
    const token = request.cookies.get('token')?.value;

    // 1. Next.js 내부 에셋 및 정적 파일은 검증을 패스합니다.
    if (pathname.startsWith('/_next') || pathname.startsWith('/images')) {
        return NextResponse.next();
    }

    // 2. 정확하게 일치하거나 퍼블릭으로 지정된 경로인지 체크 (S6 - 입력 위생 및 매칭)
    const isPublicPage = ALLOWED_PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path));

    // 3. API 라우트 보안: 로그인 안 된 상태로 데이터 API(/api/...) 접근 시 401 에러 반환 (S4 위반 방지)
    if (pathname.startsWith('/api')) {
        // 💡 [수정] 로그인 API와 텔레그램 웹훅 API는 쿠키 검증을 패스하도록 설정
        if (pathname === '/api/login' || pathname === '/api/telegram/webhook') {
            return NextResponse.next();
        }

        if (!token) {
            return new NextResponse(JSON.stringify({ error: 'Unauthorized Access Denied' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        return NextResponse.next();
    }

    // 4. 일반 페이지 보안: 토큰이 없고 퍼블릭 페이지도 아니라면 로그인 페이지로 강제 이동
    if (!token && !isPublicPage) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // 5. [선택반영] 이미 로그인한 유저가 /login에 접속하면 대시보드로 리다이렉트 (사용자 편의)
    if (token && pathname === '/login') {
        return NextResponse.redirect(new URL('/dashboard', request.url)); // 본인의 대시보드 주소로 변경
    }

    return NextResponse.next();
}

// 미들웨어가 모든 경로(API 포함)에서 항상 실행되도록 매처를 안전하게 확장합니다.
export const config = {
    matcher: [
        /*
         * 아래의 정적 파일을 제외한 모든 요청 경로와 일치하도록 설정:
         * - _next/static (정적 파일들)
         * - _next/image (이미지 최적화 파일들)
         * - favicon.ico (파비콘 파일)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
