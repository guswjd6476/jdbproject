'use client';
import './globals.css';
import { useEffect } from 'react';
import { checkAuth } from '../utills/checkAuth';
import Navbar from './components/Navbar';
import Providers from './Providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        checkAuth();
    }, []);

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
