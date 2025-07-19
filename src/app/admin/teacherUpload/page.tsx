'use client';

import React, { useState } from 'react';

interface TeacherRow {
    고유번호: string;
    등록구분: string;
    이름?: string;
    지역?: string;
    구역?: string;
    교사형태?: string;
    마지막업데이트?: string;
}

export default function TeacherUpload() {
    const [rawText, setRawText] = useState('');
    const [rows, setRows] = useState<TeacherRow[]>([]);
    const [loading, setLoading] = useState(false);

    const handleProcess = async () => {
        setLoading(true);

        const parsed = rawText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                const [id, type] = line.split(/\s+/);
                return { 고유번호: id, 등록구분: type };
            });

        try {
            // POST 저장 요청
            const postRes = await fetch('/api/teachers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed),
            });

            if (!postRes.ok) {
                let errMsg = '저장 실패';
                try {
                    const err = await postRes.json();
                    errMsg = err.error ?? errMsg;
                } catch {}
                throw new Error(errMsg);
            }

            // 저장 후 전체 데이터 GET
            const getRes = await fetch('/api/teachers');
            if (!getRes.ok) {
                let errMsg = '데이터 조회 실패';
                try {
                    const err = await getRes.json();
                    errMsg = err.error ?? errMsg;
                } catch {}
                throw new Error(errMsg);
            }
            const data: TeacherRow[] = await getRes.json();

            setRows(data);
        } catch (error) {
            alert(`오류 발생: ${(error as Error).message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4">
            <h2 className="font-bold text-lg mb-2">교사 명단 붙여넣기</h2>
            <textarea
                rows={10}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="고유번호 [탭 또는 공백] 등록구분 붙여넣기"
                className="w-full p-2 border rounded mb-2"
                disabled={loading}
            />
            <button onClick={handleProcess} className="bg-blue-600 text-white px-4 py-2 rounded" disabled={loading}>
                {loading ? '처리중...' : '저장 및 조회'}
            </button>

            <table className="mt-4 w-full table-auto border border-collapse">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border px-2">고유번호</th>
                        <th className="border px-2">등록구분</th>
                        <th className="border px-2">이름</th>
                        <th className="border px-2">지역</th>
                        <th className="border px-2">구역</th>
                        <th className="border px-2">교사형태</th>
                        <th className="border px-2">마지막업데이트</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 && (
                        <tr>
                            <td colSpan={7} className="text-center py-4 text-gray-400">
                                데이터가 없습니다.
                            </td>
                        </tr>
                    )}
                    {rows.map((row, idx) => (
                        <tr key={idx}>
                            <td className="border px-2">{row.고유번호}</td>
                            <td className="border px-2">{row.등록구분}</td>
                            <td className="border px-2">{row.이름 ?? ''}</td>
                            <td className="border px-2">{row.지역 ?? ''}</td>
                            <td className="border px-2">{row.구역 ?? ''}</td>
                            <td className="border px-2">{row.교사형태 ?? ''}</td>
                            <td className="border px-2">{row.마지막업데이트 ?? ''}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
