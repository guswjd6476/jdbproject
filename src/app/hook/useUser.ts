// useUser.ts
'use client';

import { useEffect, useState } from 'react';

// API 응답 데이터의 타입을 명확하게 정의합니다.
interface UserSession {
    isLoggedIn: boolean;
    email: string | null;
    role: 'superAdmin' | 'regionAdmin' | 'regionStaff' | 'none' | null;
    region: string | 'all' | null; // 백엔드에서는 string 또는 'all'을 반환
}

// 훅이 반환할 데이터의 타입입니다.
interface UserHookResult {
    isLoggedIn: boolean;
    email: string | null;
    role: UserSession['role'];
    region: string | 'all' | null;
    isAdmin: boolean; // 'superAdmin' 또는 'regionAdmin' 여부
    isLoading: boolean;
    error: string | null;
}

export function useUser(): UserHookResult {
    const [session, setSession] = useState<UserSession | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                // 로딩 시작 시 이전 상태 초기화
                setIsLoading(true);
                setSession(null);
                setError(null);

                const response = await fetch('/api/me');
                if (!response.ok) {
                    throw new Error(`사용자 데이터 조회 실패: ${response.statusText}`);
                }

                const data = await response.json();

                if (data.isLoggedIn) {
                    setSession({
                        isLoggedIn: true,
                        email: data.email,
                        role: data.role,
                        region: data.region,
                    });
                } else {
                    setSession({
                        isLoggedIn: false,
                        email: null,
                        role: null,
                        region: null,
                    });
                }
            } catch (err) {
                console.error('Error fetching user:', err);
                setError('사용자 정보를 불러오지 못했습니다.');
                setSession({ isLoggedIn: false, email: null, role: null, region: null });
            } finally {
                setIsLoading(false);
            }
        };

        fetchUser();
    }, []);

    const isAdmin = session?.role === 'superAdmin' || session?.role === 'regionAdmin';

    return {
        isLoggedIn: session?.isLoggedIn ?? false,
        email: session?.email ?? null,
        role: session?.role ?? null,
        region: session?.region ?? null,
        isAdmin,
        isLoading,
        error,
    };
}
