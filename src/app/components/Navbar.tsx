'use client';

import Link from 'next/link';

export default function Navbar() {
    return (
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
    );
}
