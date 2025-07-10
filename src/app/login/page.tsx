'use client';

import { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const login = useAuthStore((state) => state.login);

    const handleLogin = async () => {
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (res.ok) {
                login();

                // ✅ 쿠키가 설정되었음을 보장하기 위해 새로고침 or replace 사용
                window.location.href = '/'; // 또는 router.replace('/');
            } else {
                setError(data.error || '로그인 실패');
            }
        } catch {
            setError('서버 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-6 rounded shadow-md w-80">
                <h1 className="text-xl font-semibold mb-4 text-center">로그인</h1>
                <input
                    type="email"
                    placeholder="이메일"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border p-2 w-full mb-3 rounded"
                />
                <input
                    type="password"
                    placeholder="비밀번호"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border p-2 w-full mb-4 rounded"
                />
                {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
                <button
                    onClick={handleLogin}
                    className="bg-blue-500 text-white py-2 rounded w-full hover:bg-blue-600"
                    disabled={loading}
                >
                    {loading ? '로그인 중...' : '로그인'}
                </button>
            </div>
        </main>
    );
}
