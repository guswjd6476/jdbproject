'use client';

import { useUser } from '@/app/hook/useUser';
import React, { useState, useMemo, useCallback } from 'react';
import TableHeader from './table/TableHeader';
import TableRow from './table/TableRow';
import AddRowButton from './table/AddRowButton';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { STEPNAME, Student } from '../lib/types';
import { Spin, Alert, Modal, Button } from 'antd';
import Link from 'next/link';
import dayjs from 'dayjs';

const INITIAL_ROWS = 100;
const ADDITIONAL_ROWS = 10;

const initialRow: Student = {
    id: '',
    단계: '',
    이름: '',
    연락처: '',
    생년월일: '',
    인도자지역: '',
    인도자팀: '',
    인도자이름: '',
    인도자_고유번호: null,
    교사지역: '',
    교사팀: '',
    교사이름: '',
    교사_고유번호: null,
    도구: '',
    target: '',
};

interface MemberChoice {
    고유번호: string;
    이름: string;
    지역: string;
    팀: string;
}

interface SelectionInfo {
    rowIndex: number;
    field: '인도자' | '교사';
    choices: MemberChoice[];
}

function StudentTracker() {
    const { isAdmin, isLoading, role } = useUser();

    // 데이터 상태 관리
    const [data, setData] = useState<Student[]>(Array.from({ length: INITIAL_ROWS }, () => ({ ...initialRow })));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [selectionInfo, setSelectionInfo] = useState<SelectionInfo | null>(null);

    // 저장 가능 시간 체크 (23시~01시 제한)
    const isSaveDisabled = useMemo(() => {
        const now = dayjs();
        const currentHour = now.hour();
        return role !== 'superAdmin' && (currentHour === 23 || currentHour === 0);
    }, [role]);

    const isSkipTeamCheck = (team: string): boolean => {
        return ['타지파', '타부서', '수강생', '지교회'].some((kw) => team.includes(kw));
    };

    // DB 체크 헬퍼
    async function checkPreviousStageExists(row: Student, previousStage: string) {
        try {
            const query = new URLSearchParams({
                name: row.이름,
                stage: previousStage,
                region: row.인도자지역,
                team: row.인도자팀,
                name2: row.인도자이름,
                teacherRegion: row.교사지역,
                teacherTeam: row.교사팀,
                teacherName: row.교사이름,
            });
            const res = await fetch(`/api/students/checkPreviousStage?${query.toString()}`);
            if (!res.ok) return { exists: false, completedToday: false };
            const json = await res.json();
            return { exists: json.exists === true, completedToday: json.completedToday === true };
        } catch {
            return { exists: false, completedToday: false };
        }
    }

    // 렌더링 최적화를 위한 useCallback
    const handleChange = useCallback((index: number, field: keyof Student, value: string) => {
        setData((prev) => {
            const newData = [...prev];
            const newRow = { ...newData[index], [field]: value };

            if (['인도자지역', '인도자팀', '인도자이름'].includes(field)) newRow.인도자_고유번호 = null;
            if (['교사지역', '교사팀', '교사이름'].includes(field)) newRow.교사_고유번호 = null;

            newData[index] = newRow;
            return newData;
        });
    }, []);

    const handleDeleteRow = useCallback((index: number) => {
        setData((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const addRows = () => {
        setData((prev) => [...prev, ...Array.from({ length: ADDITIONAL_ROWS }, () => ({ ...initialRow }))]);
    };

    // 엑셀 붙여넣기 핸들러 (Capture 단계에서 가로채기)
    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
        const paste = e.clipboardData.getData('text');
        if (!paste) return;

        // 탭(\t) 또는 슬래시(/)가 포함된 경우에만 일괄 붙여넣기 실행
        if (!paste.includes('\t') && !paste.includes('/')) return;

        e.preventDefault();
        e.stopPropagation();

        // 1. 줄바꿈으로 행 분리
        const rows = paste.split(/\r?\n/).filter((row) => row.trim() !== '');

        // 2. 각 행을 탭(\t) 또는 슬래시(/)로 분리
        const parsed = rows.map((row) => {
            // 탭이 있으면 탭으로, 없으면 슬래시로 분리
            const delimiter = row.includes('\t') ? '\t' : '/';
            return row.split(delimiter).map((col) => col.trim());
        });

        setData((prev) => {
            const newData = [...prev];
            let writeIndex = newData.findIndex((r) => r.단계 === '' && r.이름 === '');
            if (writeIndex === -1) writeIndex = newData.length;

            parsed.forEach((cols) => {
                const safe = (idx: number) => cols[idx] || '';
                const 단계 = safe(0).toUpperCase();
                const 이름 = safe(1);
                if (!단계 && !이름) return;

                const newRow: Student = { ...initialRow, 단계, 이름 };

                if (단계 === '발') {
                    newRow.연락처 = safe(2);
                    newRow.인도자지역 = safe(3);
                    newRow.인도자팀 = safe(4);
                    newRow.인도자이름 = safe(5);
                    newRow.도구 = safe(6);
                }
                // ... (나머지 단계 분기 로직은 기존과 동일)
                else if (단계 === '찾') {
                    newRow.생년월일 = safe(2);
                    newRow.인도자지역 = safe(3);
                    newRow.인도자팀 = safe(4);
                    newRow.인도자이름 = safe(5);
                } else if (['합', '섭', '복', '예정', '센확'].includes(단계)) {
                    newRow.인도자지역 = safe(2);
                    newRow.인도자팀 = safe(3);
                    newRow.인도자이름 = safe(4);
                    const hasTeacher = cols.length >= 8;
                    if (hasTeacher) {
                        newRow.교사지역 = safe(5);
                        newRow.교사팀 = safe(6);
                        newRow.교사이름 = safe(7);
                        newRow.target = safe(8);
                    } else {
                        newRow.target = safe(5);
                    }
                }

                if (writeIndex < newData.length) {
                    newData[writeIndex] = newRow;
                } else {
                    newData.push(newRow);
                }
                writeIndex++;
            });
            return newData;
        });
    }, []);

    // 저장 프로세스
    const handleSubmit = async () => {
        if (isSaveDisabled) {
            setError('새벽 12시부터 1시까지는 superAdmin만 저장할 수 있습니다.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        const filledRows = data.map((row, index) => ({ row, index: index + 1 })).filter((item) => item.row.단계.trim());

        if (filledRows.length === 0) {
            setError('저장할 데이터가 없습니다.');
            setLoading(false);
            return;
        }

        const allRowErrors: string[] = [];

        for (const { row, index } of filledRows) {
            const rowErrors: string[] = [];
            const stage = row.단계.trim().toUpperCase();

            if (!STEPNAME.includes(stage)) rowErrors.push('유효하지 않은 단계');
            if (!row.이름.trim()) rowErrors.push('이름 누락');

            if (stage !== '탈락') {
                const sequentialStages = ['발', '찾', '합', '섭', '복', '예정', '센확'];
                const curIdx = sequentialStages.indexOf(stage);
                if (curIdx > 0) {
                    const prevStage = sequentialStages[curIdx - 1];
                    const existsInUI = data.some(
                        (r) => r.이름.trim() === row.이름.trim() && r.단계.trim().toUpperCase() === prevStage
                    );
                    const { exists: existsInDB, completedToday } = await checkPreviousStageExists(row, prevStage);

                    if (completedToday) rowErrors.push(`${prevStage} 오늘 완료(승급 불가)`);
                    else if (!existsInUI && !existsInDB) rowErrors.push(`${prevStage} 단계 선행 필요`);
                }
            }

            if (stage === '발') {
                if (!row.연락처.trim()) rowErrors.push('연락처/ID 누락');
                if (!['온라인', '노방', '지인'].includes(row.도구.trim()))
                    rowErrors.push('도구 오류(온라인/노방/지인)');
            }
            if (stage === '찾' && !row.생년월일.trim()) rowErrors.push('생년월일 누락');
            if (['합', '섭', '복', '예정', '센확'].includes(stage)) {
                if (!row.target?.trim()) rowErrors.push('목표월 누락');
                if (['섭', '복', '예정', '센확'].includes(stage) && (!row.교사지역 || !row.교사이름)) {
                    if (!isSkipTeamCheck(row.교사팀)) rowErrors.push('교사 정보 누락');
                }
            }

            if (rowErrors.length > 0) {
                allRowErrors.push(`${index}행(${row.이름 || '이름없음'}): ${rowErrors.join(', ')}`);
            }
        }

        if (allRowErrors.length > 0) {
            setError(`[등록 불가 사유]\n${allRowErrors.join('\n')}`);
            setLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: filledRows.map((item) => ({ ...item.row, originalIndex: item.index - 1 })),
                }),
            });
            const result = await res.json();

            if (!res.ok) {
                if (res.status === 409 && result.code === 'NEEDS_SELECTION') {
                    setSelectionInfo(result.context);
                    setError(`[${result.context.field}] 동명이인 선택 필요`);
                } else {
                    throw new Error(result.message || '서버 오류');
                }
            } else {
                setSuccess('모든 정보가 성공적으로 저장되었습니다.');
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
        const { rowIndex, field } = selectionInfo;
        setData((prev) => {
            const newData = [...prev];
            const fieldKey = field === '인도자' ? '인도자_고유번호' : '교사_고유번호';
            newData[rowIndex][fieldKey] = selectedId;
            return newData;
        });
        setSelectionInfo(null);
        setError(null);
        setTimeout(() => handleSubmit(), 100);
    };

    if (isLoading)
        return (
            <div className="flex justify-center items-center h-[80vh]">
                <Spin size="large" />
            </div>
        );

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
        <Card>
            <CardHeader>
                <div className="sticky top-0 z-10 bg-white pb-2 pt-4 flex flex-col gap-2 border-b border-gray-300">
                    <div className="flex gap-2">
                        <AddRowButton onClick={addRows} />
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
                </div>
            </CardHeader>
            <CardContent>
                {/* 타입 에러 해결을 위해 div로 감싸고 여기서 캡처링 수행 */}
                <div onPasteCapture={handlePaste}>
                    <Spin spinning={loading}>
                        <table className="border-collapse border border-slate-400 w-full">
                            <TableHeader />
                            <tbody>
                                {data.map((row, i) => (
                                    <TableRow
                                        key={i}
                                        index={i}
                                        row={row}
                                        onChange={handleChange}
                                        onDelete={handleDeleteRow}
                                        selectStages={STEPNAME}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </Spin>
                </div>
            </CardContent>
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
        </Card>
    );
}

export default StudentTracker;
