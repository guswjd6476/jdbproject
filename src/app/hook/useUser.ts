// useUser.ts
'use client';
import { useEffect, useState } from 'react';
import { Region } from '@/app/lib/types';

interface UserHookResult {
    user: Region | 'all' | null;
    isLoading: boolean;
    error: string | null;
    isAdmin: boolean;
}

export function useUser(): UserHookResult {
    const [user, setUser] = useState<Region | 'all' | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState<boolean>(false);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                setIsLoading(true);
                const response = await fetch('/api/me');
                if (!response.ok) {
                    throw new Error(`Failed to fetch user data: ${response.statusText}`);
                }
                const data = await response.json();
                const email = data?.email ?? '';

                if (email.includes('nowon')) {
                    setUser('노원');
                } else if (email.includes('dobong')) {
                    setUser('도봉');
                } else if (email.includes('sungbook')) {
                    setUser('성북');
                } else if (email.includes('joongrang')) {
                    setUser('중랑');
                } else if (email.includes('gangbook')) {
                    setUser('강북');
                } else if (email.includes('dae')) {
                    setUser('대학');
                } else if (email.includes('sae')) {
                    setUser('새신자');
                } else {
                    setUser('all');
                }

                // 관리자 이메일 검사
                setIsAdmin(email === 'jdb@jdb.com'); // 여기에 관리자 이메일을 넣으세요
                setError(null);
            } catch (err) {
                console.error('Error fetching user:', err);
                setError('사용자 정보를 불러오지 못했습니다.');
                setUser(null);
                setIsAdmin(false);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUser();
    }, []);

    return { user, isLoading, error, isAdmin };
}
