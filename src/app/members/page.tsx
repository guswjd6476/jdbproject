'use client';

import React, { useState } from 'react';

interface MemberRow {
    순번: number;
    이름: string;
    고유번호: string;
    등록구분: string;
    등록상태: string;
    등록사유: string;
    지역: string;
    구역: string;
}

export default function MemberUpload() {
    const [rows, setRows] = useState<MemberRow[]>([]);
    const [status, setStatus] = useState<string | null>(null);
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

    // 붙여넣기 처리
    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text');
        const lines = text.split('\n').filter((line) => line.trim() !== '');

        const parsedRows: MemberRow[] = lines.map((line, idx) => {
            const cols = line.split('\t');
            return {
                순번: Number(cols[0]) || idx + 1,
                이름: cols[1] || '',
                고유번호: cols[2] || '',
                등록구분: cols[3] || '',
                등록상태: cols[4] || '',
                등록사유: cols[5] || '',
                지역: cols[6] || '',
                구역: cols[7] || '',
            };
        });

        setRows(parsedRows);
        setStatus(`총 ${parsedRows.length}명 데이터 붙여넣기 완료`);
        setProgress(null);
    };

    // 배열을 n개씩 나누기
    const chunkArray = <T,>(arr: T[], size: number): T[][] => {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    };

    const handleUpload = async () => {
        if (rows.length === 0) {
            setStatus('업로드할 데이터가 없습니다.');
            return;
        }

        setStatus('업로드 중...');
        const chunkSize = 500;
        const chunks = chunkArray(rows, chunkSize);
        setProgress({ current: 0, total: chunks.length });

        try {
            for (let i = 0; i < chunks.length; i++) {
                const res = await fetch('/api/members', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(chunks[i]),
                });

                if (!res.ok) throw new Error(`서버 에러 (chunk ${i + 1})`);

                setProgress({ current: i + 1, total: chunks.length });
            }

            setStatus('✅ 업로드 성공!');
        } catch (error) {
            setStatus('❌ 업로드 실패: ' + (error as Error).message);
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">회원 재적 데이터 업로드</h1>

            <p className="mb-2 text-gray-600">엑셀에서 표를 복사한 후 아래 회색 박스 안에 붙여넣기(Ctrl+V)하세요.</p>

            <div
                onPaste={handlePaste}
                contentEditable
                suppressContentEditableWarning
                className="mb-4 min-h-[200px] border border-gray-300 rounded p-4 bg-gray-50 overflow-auto whitespace-pre-wrap"
                style={{ outline: 'none' }}
            >
                {rows.length === 0 && <p className="text-gray-400">여기에 붙여넣기 하세요</p>}
            </div>

            <div className="overflow-x-auto border border-gray-300 rounded-md max-h-[400px] overflow-y-auto">
                <table className="min-w-full text-sm border-collapse border border-gray-300">
                    <thead className="bg-gray-100 sticky top-0">
                        <tr>
                            <th className="border border-gray-300 px-2 py-1">순번</th>
                            <th className="border border-gray-300 px-2 py-1">이름</th>
                            <th className="border border-gray-300 px-2 py-1">고유번호</th>
                            <th className="border border-gray-300 px-2 py-1">등록구분</th>
                            <th className="border border-gray-300 px-2 py-1">등록상태</th>
                            <th className="border border-gray-300 px-2 py-1">등록사유</th>
                            <th className="border border-gray-300 px-2 py-1">지역</th>
                            <th className="border border-gray-300 px-2 py-1">구역</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, idx) => (
                            <tr key={idx} className="border border-gray-300">
                                <td className="border border-gray-300 px-2 py-1 text-center">{row.순번}</td>
                                <td className="border border-gray-300 px-2 py-1">{row.이름}</td>
                                <td className="border border-gray-300 px-2 py-1">{row.고유번호}</td>
                                <td className="border border-gray-300 px-2 py-1">{row.등록구분}</td>
                                <td className="border border-gray-300 px-2 py-1">{row.등록상태}</td>
                                <td className="border border-gray-300 px-2 py-1">{row.등록사유}</td>
                                <td className="border border-gray-300 px-2 py-1">{row.지역}</td>
                                <td className="border border-gray-300 px-2 py-1">{row.구역}</td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={8} className="text-center py-4 text-gray-400">
                                    데이터가 없습니다.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <button
                onClick={handleUpload}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={rows.length === 0}
            >
                업로드
            </button>

            {status && <p className="mt-2 text-gray-700">{status}</p>}
            {progress && (
                <p className="text-sm text-gray-500 mt-1">
                    진행 상황: {progress.current} / {progress.total} 청크 완료 (
                    {Math.round((progress.current / progress.total) * 100)}%)
                </p>
            )}
        </div>
    );
}
