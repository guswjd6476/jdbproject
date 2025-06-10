import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
    title: '수강생 관리 시스템',
    description: '수강생 정보를 추가하고 조회할 수 있는 시스템입니다.',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ko">
            <body className="bg-gray-50 text-gray-900">
                <header className="bg-white border-b shadow-sm">
                    <nav className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
                        <span className="text-lg font-bold">
                            <Link href="/" className="hover:underline">
                                JD
                            </Link>
                        </span>
                        <ul className="flex gap-6 text-sm md:text-base">
                            <li>
                                <Link href="/dashboard" className="hover:underline">
                                    대시보드
                                </Link>
                            </li>
                            <li>
                                <Link href="/add" className="hover:underline">
                                    수강생 추가
                                </Link>
                            </li>
                            <li>
                                <Link href="/view" className="hover:underline">
                                    수강생 조회
                                </Link>
                            </li>
                        </ul>
                    </nav>
                </header>
                <main className="max-w-6xl mx-auto">{children}</main>
            </body>
        </html>
    );
}
