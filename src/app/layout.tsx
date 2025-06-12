// src/app/layout.tsx (최상위)
import type { Metadata } from 'next';
import './globals.css';
import Navbar from './components/Navbar';
import Providers from './Providers';

export const metadata: Metadata = {
    title: '수강생 관리 시스템',
    description: '수강생 정보를 추가하고 조회할 수 있는 시스템입니다.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ko">
            <body>
                <Providers>
                    <header className="bg-white border-b shadow-sm">
                        <Navbar />
                    </header>
                    <main>{children}</main>
                </Providers>
            </body>
        </html>
    );
}
