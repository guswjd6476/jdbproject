// Navbar.tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/useAuthStore';
import { useEffect } from 'react';
import { useUser } from '@/app/hook/useUser';

export default function Navbar() {
    const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
    const logout = useAuthStore((state) => state.logout);
    const router = useRouter();
    const { isAdmin } = useUser(); // 관리자 여부 가져오기

    const handleLogout = async () => {
        const confirmed = window.confirm('정말 로그아웃하시겠습니까?');
        if (!confirmed) return;

        await fetch('/api/logout', { method: 'POST' });
        logout();
        router.push('/login');
    };

    useEffect(() => {
        if (document.cookie.includes('token')) {
            useAuthStore.setState({ isLoggedIn: true });
        }
    }, []);

    return (
        <header className="bg-white border-b shadow-sm">
            <nav className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
                <span className="text-lg font-bold">
                    <Link href="/" className="hover:underline">
                        JD
                    </Link>
                </span>
                <ul className="flex gap-6 items-center text-sm">
                    <li>
                        <Link href="/dashboard" className="hover:underline">
                            대시보드
                        </Link>
                    </li>
                    <li>
                        <Link href="/student" className="hover:underline">
                            수강생 관리
                        </Link>
                    </li>
                    {isAdmin && (
                        <li>
                            <Link href="/admin" className="hover:underline">
                                관리자
                            </Link>
                        </li>
                    )}
                    <li>
                        {isLoggedIn ? (
                            <button onClick={handleLogout} className="text-red-500 hover:underline">
                                로그아웃
                            </button>
                        ) : (
                            <Link href="/login" className="text-blue-500 hover:underline">
                                로그인
                            </Link>
                        )}
                    </li>
                </ul>
            </nav>
        </header>
    );
}
