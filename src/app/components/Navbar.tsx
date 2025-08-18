// Navbar.tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/useAuthStore';
import { useUser } from '@/app/hook/useUser';

const regionTitles: { [key: string]: string } = {
    성북: '성북화이팅',
    도봉: '도보옹화이팅',
    노원: '노원화이티잉',
    중랑: '중랑화이팅~',
    강북: '강북화이팅~',
    대학: '대학화이팅~',
    새신자: '새신자화이팅~',
};

export default function Navbar() {
    const logout = useAuthStore((state) => state.logout);
    const router = useRouter();

    // useUser 훅에서 'role'을 명시적으로 가져옵니다.
    const { region, role, isLoggedIn, isLoading } = useUser();

    const handleLogout = async () => {
        const confirmed = window.confirm('정말 로그아웃하시겠습니까?');
        if (!confirmed) return;

        await fetch('/api/logout', { method: 'POST' });
        logout();
        router.push('/login');
    };

    // 'role'에 따라 동적으로 타이틀을 생성하는 로직
    let navTitle = '전도부'; // 기본값
    if (region) {
        if (role === 'regionAdmin') {
            navTitle = `${region}전도화이팅`;
        } else {
            navTitle = regionTitles[region] || '전도부';
        }
    }

    if (isLoading) {
        return (
            <header className="bg-white border-b shadow-sm">
                <nav className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-400">로딩 중...</span>
                </nav>
            </header>
        );
    }

    return (
        <header className="bg-white border-b shadow-sm">
            <nav className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
                <span className="text-lg font-bold">
                    <Link href="/" className="hover:underline">
                        {navTitle}
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
                    {/* ✨ 1. isAdmin 대신 role === 'superAdmin'으로 조건을 변경합니다. */}
                    {role === 'superAdmin' && (
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
