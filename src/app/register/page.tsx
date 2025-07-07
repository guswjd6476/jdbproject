'use client';

import { useState } from 'react';

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        if (!email || !password) {
            alert('이메일과 비밀번호를 입력하세요.');
            return;
        }
        if (password !== confirm) {
            alert('비밀번호가 일치하지 않습니다.');
            return;
        }

        setLoading(true);
        const res = await fetch('/api/register', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
            headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();

        setLoading(false);
        if (res.ok) {
            alert('회원가입 성공! 로그인하세요.');
            setEmail('');
            setPassword('');
            setConfirm('');
        } else {
            alert(data.error || '회원가입 실패');
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded shadow w-80">
                <h1 className="text-xl font-semibold mb-4">회원가입</h1>
                <input
                    type="email"
                    className="border p-2 w-full mb-2"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <input
                    type="password"
                    className="border p-2 w-full mb-2"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <input
                    type="password"
                    className="border p-2 w-full mb-4"
                    placeholder="Confirm Password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                />
                <button
                    disabled={loading}
                    className="bg-green-500 text-white px-4 py-2 rounded w-full"
                    onClick={handleRegister}
                >
                    {loading ? '가입 중...' : '회원가입'}
                </button>
            </div>
        </main>
    );
}
