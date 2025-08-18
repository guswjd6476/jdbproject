import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/favicon.ico', '/_next', '/api'];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get('token')?.value;

    const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

    if (!token && !isPublic) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
