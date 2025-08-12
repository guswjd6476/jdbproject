'use client';

import { useUser } from '@/app/hook/useUser';
import React, { useState } from 'react';
import TableHeader from './table/TableHeader';
import TableRow from './table/TableRow';
import AddRowButton from './table/AddRowButton';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { STEPNAME, Student } from '../lib/types';
import { Spin, Alert, Modal } from 'antd';

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
};

// ✨ 백엔드에서 오는 동명이인 선택지 타입을 정의합니다.
interface MemberChoice {
    고유번호: string;
    이름: string;
    지역: string;
    팀: string;
}

// ✨ 동명이인 선택 모달의 정보를 관리할 state의 타입을 정의합니다.
interface SelectionInfo {
    rowIndex: number;
    field: '인도자' | '교사';
    choices: MemberChoice[];
}

function StudentTracker() {
    const [data, setData] = useState<Student[]>(Array.from({ length: INITIAL_ROWS }, () => ({ ...initialRow })));
    const [errorsData, setErrorsData] = useState<string[][]>(Array.from({ length: INITIAL_ROWS }, () => []));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // ✨ 동명이인 선택 모달을 위한 state
    const [selectionInfo, setSelectionInfo] = useState<SelectionInfo | null>(null);

    // ✨ 기존에 분리되어 있던 저장 확인 관련 state는 이제 필요 없습니다.
    // const [summaryList, setSummaryList] = useState<{ 이름: string; 단계: string }[]>([]);
    // const [confirmVisible, setConfirmVisible] = useState(false);

    const { isAdmin } = useUser();

    function isSkipTeamCheck(team: string): boolean {
        return ['타지파', '타부서', '수강생', '지교회'].some((kw) => team.includes(kw));
    }

    async function checkPreviousStageExists(
        name: string,
        stage: string,
        region: string,
        team: string,
        name2: string,
        teacherRegion: string,
        teacherTeam: string,
        teacherName: string
    ): Promise<{ exists: boolean; completedToday: boolean }> {
        try {
            const query = new URLSearchParams({
                name,
                stage,
                region,
                team,
                name2,
                teacherRegion,
                teacherTeam,
                teacherName,
            });
            const res = await fetch(`/api/students/checkPreviousStage?${query.toString()}`);
            if (!res.ok) return { exists: false, completedToday: false };
            const json = await res.json();
            return { exists: json.exists === true, completedToday: json.completedToday === true };
        } catch {
            return { exists: false, completedToday: false };
        }
    }

    async function validatePreviousStageForSubmit(row: Student, allRows: Student[]): Promise<string[]> {
        const errors: string[] = [];
        const stageRaw = row.단계.trim();
        const stage = stageRaw.toUpperCase() === '탈락' ? '탈락' : stageRaw.toUpperCase();
        const 단계순서 = ['발', '찾', '합', '섭', '복', '예정'];

        if (stage !== '탈락' && !단계순서.includes(stage)) {
            errors.push('유효한 단계가 아닙니다.');
            return errors;
        }

        if (!row.이름.trim()) {
            errors.push('이름이 필요합니다.');
            return errors;
        }

        if (stage === '탈락') {
            const hasFullIndo = row.인도자지역 && row.인도자팀 && row.인도자이름;
            const hasFullTeacher = row.교사지역 && row.교사팀 && row.교사이름;
            if (!hasFullIndo && !hasFullTeacher) {
                errors.push('탈락 시 인도자 정보 또는 교사 정보가 필요합니다.');
            }
            try {
                const query = new URLSearchParams({
                    name: row.이름.trim(),
                    stage: '탈락',
                    region: row.인도자지역.trim(),
                    team: row.인도자팀.trim(),
                    name2: row.인도자이름.trim(),
                    teacherRegion: row.교사지역.trim(),
                    teacherTeam: row.교사팀.trim(),
                    teacherName: row.교사이름.trim(),
                });
                const res = await fetch(`/api/students/checkPreviousStage?${query.toString()}`);
                const json = await res.json();
                if (!res.ok) {
                    errors.push(json.message || '유효성 검사 중 오류가 발생했습니다.');
                } else if (json.exists === true) {
                    errors.push('이미 탈락으로 등록된 학생입니다.');
                }
            } catch (e) {
                errors.push('서버 통신 중 오류가 발생했습니다.');
            }
            return errors;
        }
        const currentStageIndex = 단계순서.indexOf(stage);
        if (currentStageIndex > 0) {
            const previousStage = 단계순서[currentStageIndex - 1];
            const existsInUI = allRows.some(
                (r) => r.이름.trim() === row.이름.trim() && r.단계.trim().toUpperCase() === previousStage
            );
            const { exists: existsInDB, completedToday } = await checkPreviousStageExists(
                row.이름,
                previousStage,
                row.인도자지역,
                row.인도자팀,
                row.인도자이름,
                row.교사지역,
                row.교사팀,
                row.교사이름
            );
            if (completedToday) {
                errors.push(`${previousStage} 단계를 오늘 완료하여 현재 단계 등록이 불가능합니다.`);
            } else if (!existsInUI && !existsInDB) {
                errors.push(`${previousStage} 단계가 먼저 등록되어야 합니다.`);
            }
        }
        if (stage === '발' && !row.연락처.trim()) {
            errors.push('발굴단계는 연락처 뒷자리 또는 온라인 아이디가 필요합니다.');
        }
        if (stage === '찾' && !row.생년월일.trim()) {
            errors.push('찾기단계는 생년월일이 필요합니다.');
        }
        if (['섭', '복', '예정'].includes(stage)) {
            const skip = isSkipTeamCheck(row.교사팀);
            if (!skip && (!row.교사지역 || !row.교사팀 || !row.교사이름)) {
                errors.push('C~F단계는 교사 정보가 필요합니다.');
            }
        }
        return errors;
    }

    function validateRow(row: Student, allRows: Student[]): string[] {
        const errors: string[] = [];
        const stage = row.단계.trim().toUpperCase();
        if (!STEPNAME.includes(stage)) errors.push('유효한 단계가 아닙니다.');
        if (!row.이름.trim()) errors.push('이름이 필요합니다.');
        if (stage === '탈락') {
            const duplicates = allRows.filter((r) => r.이름.trim() === row.이름.trim() && r.단계 === '탈락');
            if (duplicates.length > 1) {
                errors.push('이미 탈락 처리된 수강생입니다.');
            }
            return errors;
        }
        if (stage === '발' && !row.연락처.trim()) errors.push('A단계는 연락처가 필요합니다.');
        if (stage === '찾' && !row.생년월일.trim()) errors.push('B단계는 생년월일이 필요합니다.');
        if (['섭', '복', '예정'].includes(stage)) {
            const skip = isSkipTeamCheck(row.교사팀);
            if (!skip && (!row.교사지역 || !row.교사팀 || !row.교사이름)) {
                errors.push('교사 정보가 필요합니다.');
            }
        }
        return errors;
    }

    const isSaveDisabledByTime = !isAdmin && new Date().getHours() >= 21 && new Date().getHours() < 24;

    const handleChange = (index: number, field: keyof Student, value: string) => {
        setData((prev) => {
            const newData = [...prev];
            if (field === '인도자_고유번호' || field === '교사_고유번호') return newData;

            const newRow = { ...newData[index], [field]: value };

            // ✨ 인도자나 교사 정보가 변경되면, 확정되었던 고유번호를 초기화해서 다시 조회하도록 함
            if (['인도자지역', '인도자팀', '인도자이름'].includes(field)) {
                newRow.인도자_고유번호 = null;
            }
            if (['교사지역', '교사팀', '교사이름'].includes(field)) {
                newRow.교사_고유번호 = null;
            }

            newData[index] = newRow;
            return newData;
        });
    };

    const handleDeleteRow = (index: number) => {
        setData((prev) => prev.filter((_, i) => i !== index));
        setErrorsData((prev) => prev.filter((_, i) => i !== index));
    };

    const addRows = () => {
        setData((prev) => [...prev, ...Array.from({ length: ADDITIONAL_ROWS }, () => ({ ...initialRow }))]);
        setErrorsData((prev) => [...prev, ...Array.from({ length: ADDITIONAL_ROWS }, () => [])]);
    };

    const safe = (arr: string[], index: number) => (index < arr.length ? arr[index].trim() : '');

    const handlePaste = (e: React.ClipboardEvent<HTMLTableElement>) => {
        e.preventDefault();
        const paste = e.clipboardData.getData('text');
        const rows = paste.split('\n').filter(Boolean);
        const parsed = rows.map((row) => row.split(/\t|\//));
        setData((prev) => {
            const newData = [...prev];
            let writeIndex = newData.findIndex((r) => r.단계 === '');
            parsed.forEach((cols) => {
                if (writeIndex < 0 || writeIndex >= newData.length) return;
                const 단계 = safe(cols, 0)?.toUpperCase();
                const 이름 = safe(cols, 1);
                const newRow: Student = { ...initialRow, 단계, 이름 };
                if (단계 === '발') {
                    newRow.연락처 = safe(cols, 2);
                    newRow.인도자지역 = safe(cols, 3);
                    newRow.인도자팀 = safe(cols, 4);
                    newRow.인도자이름 = safe(cols, 5);
                } else if (단계 === '찾') {
                    newRow.생년월일 = safe(cols, 2);
                    newRow.인도자지역 = safe(cols, 3);
                    newRow.인도자팀 = safe(cols, 4);
                    newRow.인도자이름 = safe(cols, 5);
                } else if (['섭', '복', '예정'].includes(단계)) {
                    newRow.인도자지역 = safe(cols, 2);
                    newRow.인도자팀 = safe(cols, 3);
                    newRow.인도자이름 = safe(cols, 4);
                    newRow.교사지역 = safe(cols, 5);
                    newRow.교사팀 = safe(cols, 6);
                    newRow.교사이름 = safe(cols, 7);
                } else if (단계 === '탈락') {
                    newRow.인도자지역 = safe(cols, 2);
                    newRow.인도자팀 = safe(cols, 3);
                    newRow.인도자이름 = safe(cols, 4);
                    if (cols.length >= 8) {
                        newRow.교사지역 = safe(cols, 5);
                        newRow.교사팀 = safe(cols, 6);
                        newRow.교사이름 = safe(cols, 7);
                    }
                }
                newData[writeIndex] = newRow;
                writeIndex++;
            });
            setErrorsData((prevErrors) => newData.map((r) => (r.단계 ? validateRow(r, newData) : [])));
            return newData;
        });
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);

        const filledRows = data.filter((r) => r.단계.trim());
        const validationPromises = filledRows.map((row) => validatePreviousStageForSubmit(row, filledRows));
        const newErrorsDataArray = await Promise.all(validationPromises);
        const newErrorsData: string[][] = Array.from({ length: data.length }, () => []);
        let filledRowIndex = 0;
        data.forEach((row, i) => {
            if (row.단계.trim()) {
                newErrorsData[i] = newErrorsDataArray[filledRowIndex];
                filledRowIndex++;
            }
        });
        setErrorsData(newErrorsData);

        if (newErrorsData.flat().length > 0) {
            setError('유효성 검사 오류가 있습니다. 각 행을 확인해 주세요.');
            setLoading(false);
            return;
        }

        try {
            const dataWithIndex = data.map((r, index) => ({ ...r, originalIndex: index })).filter((r) => r.단계.trim());

            const res = await fetch('/api/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: dataWithIndex }),
            });

            const result = await res.json();

            if (!res.ok) {
                if (res.status === 409 && result.code === 'NEEDS_SELECTION') {
                    setError(
                        `[${result.context.field}] '${result.context.choices[0].이름}' 동명이인이 있습니다. 한 명을 선택해주세요.`
                    );
                    setSelectionInfo(result.context);
                } else {
                    throw new Error(result.message || '서버 오류가 발생했습니다.');
                }
            } else {
                setSuccess('모든 정보가 성공적으로 저장되었습니다.');
                setData(Array.from({ length: INITIAL_ROWS }, () => ({ ...initialRow })));
                setErrorsData(Array.from({ length: INITIAL_ROWS }, () => []));
            }
        } catch (err: any) {
            if (!selectionInfo) {
                setError(err.message || '알 수 없는 서버 오류');
            }
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

        setTimeout(() => {
            handleSubmit();
        }, 100);
    };

    return (
        <Card>
            <CardHeader>
                <div className="sticky top-0 z-10 bg-white pb-2 pt-4 flex gap-2 border-b border-gray-300">
                    <AddRowButton onClick={addRows} />
                    <button
                        onClick={handleSubmit}
                        disabled={loading || isSaveDisabledByTime}
                        className={`px-4 py-2 rounded text-white ${
                            loading || isSaveDisabledByTime ? 'bg-gray-400' : 'bg-blue-600'
                        }`}
                    >
                        저장하기
                    </button>
                    <div className="min-w-[200px] whitespace-pre-line">
                        {error && <Alert message={error} type="error" showIcon />}
                        {success && <Alert message={success} type="success" showIcon />}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Spin spinning={loading}>
                    <table className="border-collapse border border-slate-400" onPaste={handlePaste}>
                        <TableHeader />
                        <tbody>
                            {data.map((row, i) => (
                                <TableRow
                                    key={i}
                                    index={i}
                                    row={row}
                                    errors={errorsData[i]}
                                    onChange={handleChange}
                                    onDelete={() => handleDeleteRow(i)}
                                    selectStages={STEPNAME}
                                />
                            ))}
                        </tbody>
                    </table>
                </Spin>
            </CardContent>

            <Modal
                title="동명이인 선택"
                open={!!selectionInfo}
                onCancel={() => {
                    setSelectionInfo(null);
                    setError(null);
                }}
                footer={null}
                width={600}
            >
                {selectionInfo && (
                    <div>
                        <p>
                            <b>{selectionInfo.field}</b> '{selectionInfo.choices[0].이름}'님이 여러 명 발견되었습니다.{' '}
                            <br />
                            아래 목록에서 정확한 한 명을 선택해 주세요.
                        </p>
                        <div
                            style={{
                                maxHeight: 300,
                                overflowY: 'auto',
                                marginTop: 16,
                                border: '1px solid #eee',
                                borderRadius: '8px',
                            }}
                        >
                            {selectionInfo.choices.map((member) => (
                                <div
                                    key={member.고유번호}
                                    style={{
                                        padding: '12px',
                                        borderBottom: '1px solid #eee',
                                        cursor: 'pointer',
                                        transition: 'background-color 0.2s',
                                    }}
                                    onClick={() => handleMemberSelection(member.고유번호)}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                    <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{member.이름}</div>
                                    <div style={{ color: '#555' }}>
                                        {member.지역} / {member.팀 || '팀 정보 없음'}
                                    </div>
                                    <div style={{ color: '#888', fontSize: '12px', marginTop: '4px' }}>
                                        고유번호: {member.고유번호}
                                    </div>
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
