'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useUser } from '@/app/hook/useUser';
import { Spin, Alert, Modal, Button } from 'antd';
import dayjs from 'dayjs';
import Link from 'next/link';

type Role = '노방' | '온라인' | '만남' | '교사' | '잎사귀';
const ROLES: Role[] = ['노방', '온라인', '만남', '교사', '잎사귀'];

type ActivityRow = {
    id: string;
    날짜: string; // '' or YYYY-MM-DD
    지역: string;
    팀: string;
    이름: string;
    활동: Role | '';
    memo: string;
    member_id: string | null; // 동명이인 선택 후 재저장용
};

interface MemberChoice {
    고유번호: string;
    이름: string;
    지역: string;
    팀: string;
}

interface SelectionInfo {
    rowIndex: number;
    field: '멤버';
    choices: MemberChoice[];
}

const INITIAL_ROWS = 100;
const ADDITIONAL_ROWS = 10;

const initialRow: ActivityRow = {
    id: '',
    날짜: '',
    지역: '',
    팀: '',
    이름: '',
    활동: '',
    memo: '',
    member_id: null,
};

export default function ActivitiesPage() {
    const { isAdmin, isLoading, role } = useUser();

    const [data, setData] = useState<ActivityRow[]>(Array.from({ length: INITIAL_ROWS }, () => ({ ...initialRow })));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [selectionInfo, setSelectionInfo] = useState<SelectionInfo | null>(null);

    // 저장 제한(23시/0시) - StudentTracker와 동일
    const isSaveDisabled = useMemo(() => {
        const now = dayjs();
        const h = now.hour();
        return role !== 'superAdmin' && (h === 23 || h === 0);
    }, [role]);

    const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

    const addRows = () => {
        setData((prev) => [...prev, ...Array.from({ length: ADDITIONAL_ROWS }, () => ({ ...initialRow }))]);
    };

    const handleChange = useCallback((index: number, field: keyof ActivityRow, value: string) => {
        setData((prev) => {
            const newData = [...prev];
            const next = { ...newData[index], [field]: value };

            // 지역/팀/이름 바뀌면 동명이인 선택값 무효
            if (['지역', '팀', '이름'].includes(field)) next.member_id = null;

            newData[index] = next;
            return newData;
        });
    }, []);

    const handleDeleteRow = useCallback((index: number) => {
        setData((prev) => prev.filter((_, i) => i !== index));
    }, []);

    // 붙여넣기: 탭(엑셀) / 슬래시 둘 다 지원
    // - 날짜가 첫 칸이면: 날짜/지역/팀/이름/활동/메모
    // - 날짜가 없으면: 지역/팀/이름/활동/메모  (날짜는 비워두고 서버에서 오늘 처리)
    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
        const paste = e.clipboardData.getData('text');
        if (!paste) return;

        if (!paste.includes('\t') && !paste.includes('/')) return;

        e.preventDefault();
        e.stopPropagation();

        const rows = paste.split(/\r?\n/).filter((r) => r.trim() !== '');
        const parsed = rows.map((r) => {
            const delimiter = r.includes('\t') ? '\t' : '/';
            return r.split(delimiter).map((c) => c.trim());
        });

        setData((prev) => {
            const newData = [...prev];
            let writeIndex = newData.findIndex((r) => !r.지역 && !r.이름 && !r.활동);
            if (writeIndex === -1) writeIndex = newData.length;

            parsed.forEach((cols) => {
                const safe = (i: number) => cols[i] || '';
                const first = safe(0);
                const hasDate = isValidDate(first);

                const rowObj: ActivityRow = { ...initialRow };

                if (hasDate) {
                    rowObj.날짜 = first;
                    rowObj.지역 = safe(1);
                    rowObj.팀 = safe(2);
                    rowObj.이름 = safe(3);
                    rowObj.활동 = safe(4) as Role;
                    rowObj.memo = safe(5);
                } else {
                    rowObj.날짜 = ''; // 서버에서 오늘
                    rowObj.지역 = safe(0);
                    rowObj.팀 = safe(1);
                    rowObj.이름 = safe(2);
                    rowObj.활동 = safe(3) as Role;
                    rowObj.memo = safe(4);
                }

                if (!rowObj.이름.trim() && !rowObj.활동 && !rowObj.지역.trim()) return;

                if (writeIndex < newData.length) newData[writeIndex] = rowObj;
                else newData.push(rowObj);
                writeIndex++;
            });

            return newData;
        });
    }, []);

    const validateRows = () => {
        const filled = data
            .map((row, idx) => ({ row, index: idx + 1 }))
            .filter((x) => x.row.이름.trim() || x.row.활동 || x.row.지역.trim());

        if (filled.length === 0) return { ok: false, message: '저장할 데이터가 없습니다.' };

        const allErrors: string[] = [];

        for (const { row, index } of filled) {
            const errs: string[] = [];

            if (row.날짜 && !isValidDate(row.날짜.trim())) errs.push('날짜 형식 오류(YYYY-MM-DD)');
            if (!row.지역.trim()) errs.push('지역 누락');
            if (!row.이름.trim()) errs.push('이름 누락');
            if (!row.활동) errs.push('활동 누락');
            if (row.활동 && !ROLES.includes(row.활동 as Role)) errs.push('활동 값 오류');

            if (errs.length) allErrors.push(`${index}행(${row.이름 || '이름없음'}): ${errs.join(', ')}`);
        }

        if (allErrors.length) return { ok: false, message: `[등록 불가 사유]\n${allErrors.join('\n')}` };
        return { ok: true, message: '' };
    };

    const handleSubmit = async () => {
        if (isSaveDisabled) {
            setError('새벽 12시부터 1시까지는 superAdmin만 저장할 수 있습니다.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        const v = validateRows();
        if (!v.ok) {
            setError(v.message);
            setLoading(false);
            return;
        }

        const payload = data
            .map((r, idx) => ({ ...r, originalIndex: idx }))
            .filter((r) => r.지역.trim() && r.이름.trim() && r.활동);

        try {
            const res = await fetch('/api/activities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: payload.map((r) => ({
                        날짜: r.날짜 || null,
                        지역: r.지역,
                        팀: r.팀,
                        이름: r.이름,
                        활동: r.활동,
                        memo: r.memo || null,
                        member_id: r.member_id,
                        originalIndex: r.originalIndex,
                    })),
                }),
            });

            const result = await res.json();

            if (!res.ok) {
                if (res.status === 409 && result.code === 'NEEDS_SELECTION') {
                    setSelectionInfo(result.context);
                    setError(`[멤버] 동명이인 선택 필요`);
                } else {
                    throw new Error(result.message || '서버 오류');
                }
            } else {
                setSuccess('모든 활동이 성공적으로 저장되었습니다.');
                setData(Array.from({ length: INITIAL_ROWS }, () => ({ ...initialRow })));
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleMemberSelection = (selectedId: string) => {
        if (!selectionInfo) return;
        const { rowIndex } = selectionInfo;

        setData((prev) => {
            const newData = [...prev];
            newData[rowIndex] = { ...newData[rowIndex], member_id: selectedId };
            return newData;
        });

        setSelectionInfo(null);
        setError(null);

        // 바로 재저장 (StudentTracker 방식)
        setTimeout(() => handleSubmit(), 100);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-[80vh]">
                <Spin size="large" />
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="p-10 text-center">
                <Alert
                    message="접근 권한 없음"
                    type="error"
                    showIcon
                />
                <Link href="/student/view">
                    <Button
                        type="primary"
                        className="mt-5"
                    >
                        조회 페이지로 돌아가기
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <>
            <div className="sticky top-0 z-10 bg-white pb-2 pt-4 flex flex-col gap-2 border-b border-gray-300">
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={addRows}
                        className="px-4 py-2 rounded text-white bg-green-600"
                    >
                        + 행 추가
                    </button>

                    <button
                        onClick={handleSubmit}
                        disabled={loading || isSaveDisabled}
                        className={`px-4 py-2 rounded text-white ${
                            loading || isSaveDisabled ? 'bg-gray-400' : 'bg-blue-600'
                        }`}
                    >
                        저장하기
                    </button>
                </div>

                {error && (
                    <Alert
                        message={<div className="whitespace-pre-wrap">{error}</div>}
                        type="error"
                        showIcon
                    />
                )}
                {success && (
                    <Alert
                        message={success}
                        type="success"
                        showIcon
                    />
                )}

                {isSaveDisabled && !error && (
                    <Alert
                        message="자정 전후 1시간은 superAdmin만 가능합니다."
                        type="warning"
                        showIcon
                    />
                )}

                <div className="text-sm text-gray-600">
                    붙여넣기 예시
                    <br />
                    2026-03-01/강북/2/강현정/교사/메모
                    <br />
                    강북/2/강현정/노방 (날짜 생략 시 오늘로 저장)
                </div>
            </div>

            <div onPasteCapture={handlePaste}>
                <Spin spinning={loading}>
                    <table className="border-collapse border border-slate-400 w-full">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-slate-300 p-2 w-[60px]">No</th>
                                <th className="border border-slate-300 p-2 w-[140px]">날짜</th>
                                <th className="border border-slate-300 p-2 w-[140px]">지역</th>
                                <th className="border border-slate-300 p-2 w-[100px]">팀</th>
                                <th className="border border-slate-300 p-2 w-[140px]">이름</th>
                                <th className="border border-slate-300 p-2 w-[140px]">활동</th>
                                <th className="border border-slate-300 p-2 w-[80px]">삭제</th>
                            </tr>
                        </thead>

                        <tbody>
                            {data.map((row, i) => (
                                <tr key={i}>
                                    <td className="border border-slate-300 p-2 text-center">{i + 1}</td>

                                    <td className="border border-slate-300 p-2">
                                        <input
                                            className="w-full border rounded p-1"
                                            value={row.날짜}
                                            placeholder="YYYY-MM-DD (비우면 오늘)"
                                            onChange={(e) => handleChange(i, '날짜', e.target.value)}
                                        />
                                    </td>

                                    <td className="border border-slate-300 p-2">
                                        <input
                                            className="w-full border rounded p-1"
                                            value={row.지역}
                                            onChange={(e) => handleChange(i, '지역', e.target.value)}
                                        />
                                    </td>

                                    <td className="border border-slate-300 p-2">
                                        <input
                                            className="w-full border rounded p-1"
                                            value={row.팀}
                                            onChange={(e) => handleChange(i, '팀', e.target.value)}
                                        />
                                    </td>

                                    <td className="border border-slate-300 p-2">
                                        <input
                                            className="w-full border rounded p-1"
                                            value={row.이름}
                                            onChange={(e) => handleChange(i, '이름', e.target.value)}
                                        />
                                    </td>

                                    <td className="border border-slate-300 p-2">
                                        <select
                                            className="w-full border rounded p-1"
                                            value={row.활동}
                                            onChange={(e) => handleChange(i, '활동', e.target.value)}
                                        >
                                            <option value="">선택</option>
                                            {ROLES.map((r) => (
                                                <option
                                                    key={r}
                                                    value={r}
                                                >
                                                    {r}
                                                </option>
                                            ))}
                                        </select>
                                    </td>

                                    <td className="border border-slate-300 p-2 text-center">
                                        <button
                                            className="px-2 py-1 bg-red-500 text-white rounded"
                                            onClick={() => handleDeleteRow(i)}
                                            type="button"
                                        >
                                            삭제
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Spin>
            </div>
            <Modal
                title="동명이인 선택"
                open={!!selectionInfo}
                onCancel={() => setSelectionInfo(null)}
                footer={null}
                width={600}
            >
                {selectionInfo && (
                    <div>
                        <p>
                            <b>{selectionInfo.field}</b> '{selectionInfo.choices[0].이름}' 동명이인 목록입니다.
                        </p>

                        <div className="max-h-[300px] overflow-y-auto mt-4 border rounded-lg">
                            {selectionInfo.choices.map((member) => (
                                <div
                                    key={member.고유번호}
                                    className="p-3 border-b cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleMemberSelection(member.고유번호)}
                                >
                                    <div className="font-bold">{member.이름}</div>
                                    <div className="text-sm text-gray-600">
                                        {member.지역} / {member.팀 || '팀 정보 없음'}
                                    </div>
                                    <div className="text-xs text-gray-400">고유번호: {member.고유번호}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
}
