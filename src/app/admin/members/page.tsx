'use client';

import React, { useMemo, useState } from 'react';
import { Modal } from 'antd';

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

interface DeleteCandidate {
    고유번호: string;
    이름: string;
    지역: string;
    구역: string;
}

export default function MemberUpload() {
    const [rows, setRows] = useState<MemberRow[]>([]);
    const [status, setStatus] = useState<string | null>(null);
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

    const [skippedNonNumericCount, setSkippedNonNumericCount] = useState(0);

    // 삭제 후보(= 이번 업로드에 없는 숫자 고유번호들)
    const [deleteCandidates, setDeleteCandidates] = useState<DeleteCandidate[]>([]);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const startsWithDigit = (s: string) => /^\d/.test((s ?? '').trim());

    // 붙여넣기 처리
    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text');
        const lines = text.split('\n').filter((line) => line.trim() !== '');

        const parsedAll: MemberRow[] = lines.map((line, idx) => {
            const cols = line.split('\t');
            return {
                순번: Number(cols[0]) || idx + 1,
                이름: cols[1] || '',
                고유번호: (cols[2] || '').trim(),
                등록구분: cols[3] || '',
                등록상태: cols[4] || '',
                등록사유: cols[5] || '',
                지역: cols[6] || '',
                구역: cols[7] || '',
            };
        });

        // ✅ 숫자로 시작하는 고유번호만 업로드 대상으로 유지
        const numericRows = parsedAll.filter((r) => startsWithDigit(r.고유번호));
        const skipped = parsedAll.length - numericRows.length;

        setRows(numericRows);
        setSkippedNonNumericCount(skipped);
        setStatus(`총 ${parsedAll.length}명 중 업로드 대상(숫자 고유번호) ${numericRows.length}명 / 제외 ${skipped}명`);
        setProgress(null);

        // 이전 삭제 후보 초기화
        setDeleteCandidates([]);
        setDeleteModalOpen(false);
    };

    // 배열을 n개씩 나누기
    const chunkArray = <T,>(arr: T[], size: number): T[][] => {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
        return chunks;
    };

    // 이번 업로드의 숫자 고유번호 목록
    const uploadedNumericIds = useMemo(() => rows.map((r) => r.고유번호.trim()).filter(Boolean), [rows]);

    const handleUpload = async () => {
        if (rows.length === 0) {
            setStatus('업로드할 데이터가 없습니다. (숫자로 시작하는 고유번호만 업로드됩니다)');
            return;
        }

        setStatus('업로드(업서트) 중...');
        const chunkSize = 500;
        const chunks = chunkArray(rows, chunkSize);
        setProgress({ current: 0, total: chunks.length });

        try {
            // 1) 업서트(있으면 업데이트, 없으면 삽입)
            for (let i = 0; i < chunks.length; i++) {
                const res = await fetch('/api/members', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(chunks[i]),
                });

                console.log('status', res.status);

                const text = await res.text();
                console.log(text);

                if (!res.ok) {
                    throw new Error(text);
                }

                setProgress({ current: i + 1, total: chunks.length });
            }

            setStatus('✅ 업서트 완료! (전출/누락 삭제 후보 계산 중...)');

            // 2) “이번 업로드에 없는 숫자 고유번호” 목록 프리뷰
            const previewRes = await fetch('/api/members/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uploadedIds: uploadedNumericIds }),
            });
            const previewJson = await previewRes.json();
            if (!previewRes.ok) throw new Error(previewJson?.message || '삭제 후보 조회 실패');

            const toDelete: DeleteCandidate[] = Array.isArray(previewJson?.toDelete) ? previewJson.toDelete : [];

            if (toDelete.length === 0) {
                setStatus('✅ 업로드 완료! (삭제할 전출/누락 명단 없음)');
                return;
            }

            // 3) 사용자에게 “삭제할거냐?” 묻기(공유 후)
            setDeleteCandidates(toDelete);
            setDeleteModalOpen(true);
            setStatus(`⚠️ 이번 업로드에 없는 숫자 고유번호 ${toDelete.length}명 발견 (전출/누락으로 삭제할지 선택)`);
        } catch (error) {
            setStatus('❌ 업로드 실패: ' + (error as Error).message);
        }
    };

    const handleConfirmDelete = async () => {
        if (deleteCandidates.length === 0) {
            setDeleteModalOpen(false);
            return;
        }

        setDeleting(true);
        try {
            const deleteIds = deleteCandidates.map((c) => c.고유번호);

            const res = await fetch('/api/members/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmDelete: true, deleteIds }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.message || '삭제 실패');

            setStatus(`✅ 삭제 완료: ${json.deleted ?? 0}명 (문자열/UUID 고유번호는 유지됨)`);
            setDeleteModalOpen(false);
            setDeleteCandidates([]);
        } catch (e: any) {
            setStatus('❌ 삭제 실패: ' + (e.message ?? '오류'));
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">회원 재적 데이터 업로드</h1>

            <p className="mb-2 text-gray-600">
                엑셀에서 표를 복사한 후 아래 회색 박스 안에 붙여넣기(Ctrl+V)하세요.
                <br />
                <b>※ 고유번호가 숫자로 시작하는 행만 업로드됩니다. UUID(문자 시작) 고유번호는 그대로 유지됩니다.</b>
            </p>

            <div
                onPaste={handlePaste}
                contentEditable
                suppressContentEditableWarning
                className="mb-4 min-h-[200px] border border-gray-300 rounded p-4 bg-gray-50 overflow-auto whitespace-pre-wrap"
                style={{ outline: 'none' }}
            >
                {rows.length === 0 && <p className="text-gray-400">여기에 붙여넣기 하세요</p>}
            </div>

            <div className="mb-2 text-sm text-gray-600">
                업로드 대상: <b>{rows.length}</b>명 / 제외(문자 시작 고유번호): <b>{skippedNonNumericCount}</b>명
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
                            <tr
                                key={idx}
                                className="border border-gray-300"
                            >
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
                                <td
                                    colSpan={8}
                                    className="text-center py-4 text-gray-400"
                                >
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
                업로드(업서트) + 전출/누락 확인
            </button>

            {status && <p className="mt-2 text-gray-700 whitespace-pre-wrap">{status}</p>}
            {progress && (
                <p className="text-sm text-gray-500 mt-1">
                    진행 상황: {progress.current} / {progress.total} 청크 완료 (
                    {Math.round((progress.current / progress.total) * 100)}%)
                </p>
            )}

            <Modal
                title="전출/누락 명단 삭제 확인"
                open={deleteModalOpen}
                onCancel={() => setDeleteModalOpen(false)}
                okText={deleting ? '삭제 중...' : `삭제 (${deleteCandidates.length}명)`}
                cancelText="삭제 안 함(유지)"
                onOk={handleConfirmDelete}
                confirmLoading={deleting}
                width={720}
            >
                <div className="text-sm text-gray-700">
                    이번 업로드(숫자 고유번호 명단)에 없는 <b>{deleteCandidates.length}명</b>이 발견되었습니다.
                    <br />
                    전출/누락으로 보고 삭제할까요?
                    <br />
                    <b className="text-red-600">※ UUID(문자 시작) 고유번호는 삭제 대상에 포함되지 않습니다.</b>
                </div>

                <div className="mt-4 max-h-[320px] overflow-y-auto border rounded">
                    {deleteCandidates.map((m) => (
                        <div
                            key={m.고유번호}
                            className="p-2 border-b"
                        >
                            <div className="font-semibold">{m.이름}</div>
                            <div className="text-xs text-gray-600">
                                {m.지역} / {m.구역} — 고유번호: {m.고유번호}
                            </div>
                        </div>
                    ))}
                </div>
            </Modal>
        </div>
    );
}
