'use client';

import { useUser } from '@/app/hook/useUser';
import React, { useState, useMemo } from 'react'; // useMemo 임포트 추가
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

    const [data, setData] = useState<Student[]>(Array.from({ length: INITIAL_ROWS }, () => ({ ...initialRow })));
    const [errorsData, setErrorsData] = useState<string[][]>(Array.from({ length: INITIAL_ROWS }, () => []));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [selectionInfo, setSelectionInfo] = useState<SelectionInfo | null>(null);

    // 저장 버튼 비활성화 여부를 계산하는 useMemo
    const isSaveDisabled = useMemo(() => {
        const now = dayjs();
        const currentHour = now.hour();
        // superAdmin이 아니면서 현재 시간이 23시 (오후 11시)부터 24시 (다음날 0시) 사이일 경우
        return role !== 'superAdmin' && (currentHour >= 23 || currentHour === 0);
    }, [role]); // role이 변경될 때만 다시 계산

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
        const stage = row.단계.trim().toUpperCase();

        if (!STEPNAME.includes(stage)) {
            errors.push('유효한 단계가 아닙니다. STEPNAME 정의를 확인하세요.');
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
                errors.push('탈락 시 인도자 또는 교사 정보 중 하나는 반드시 필요합니다.');
            }
            return errors;
        }

        const sequentialStages = ['발', '찾', '합', '섭', '복', '예정', '센확'];
        const currentStageIndex = sequentialStages.indexOf(stage);

        if (currentStageIndex > 0) {
            const previousStage = sequentialStages[currentStageIndex - 1];
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
        if (stage === '발') {
            if (!row.연락처.trim()) errors.push('발굴단계는 연락처 뒷자리 또는 온라인 아이디가 필요합니다.');
            if (!row.도구.trim()) {
                errors.push('발 단계에서는 도구 입력이 필수입니다.');
            } else if (!['온라인', '노방', '지인'].includes(row.도구.trim())) {
                errors.push('도구는 "온라인" 또는 "노방" 또는 "지인" 중 하나여야 합니다.');
            }
        }
        if (stage === '찾' && !row.생년월일.trim()) {
            errors.push('찾기단계는 생년월일이 필요합니다.');
        }
        if (['합', '섭', '복', '예정', '센확'].includes(stage)) {
            if (!row.target.trim()) {
                errors.push('합 단계부터 목표월 입력이 필수입니다.');
            } else {
                const validMonths = [
                    '1월',
                    '2월',
                    '3월',
                    '4월',
                    '5월',
                    '6월',
                    '7월',
                    '8월',
                    '9월',
                    '10월',
                    '11월',
                    '12월',
                ];
                if (!validMonths.includes(row.target.trim())) {
                    errors.push('목표월은 "1월"부터 "12월"까지만 가능합니다.');
                }
            }
        }

        if (['섭', '복', '예정', '센확'].includes(stage)) {
            if (!row.교사지역 || !row.교사팀 || !row.교사이름) {
                const skip = isSkipTeamCheck(row.교사팀);
                if (!skip) errors.push('섭, 복, 예정, 센확 단계는 교사 정보가 필요합니다.');
            }
        }
        return errors;
    }

    function validateRow(row: Student, allRows: Student[]): string[] {
        const errors: string[] = [];
        const stage = row.단계.trim().toUpperCase();
        if (!STEPNAME.includes(stage)) errors.push('유효한 단계가 아닙니다.');
        if (!row.이름.trim()) errors.push('이름이 필요합니다.');
        return errors;
    }

    const handleChange = (index: number, field: keyof Student, value: string) => {
        setData((prev) => {
            const newData = [...prev];
            if (field === '인도자_고유번호' || field === '교사_고유번호') return newData;
            const newRow = { ...newData[index], [field]: value };
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
                    newRow.도구 = safe(cols, 6);
                } else if (단계 === '찾') {
                    newRow.생년월일 = safe(cols, 2);
                    newRow.인도자지역 = safe(cols, 3);
                    newRow.인도자팀 = safe(cols, 4);
                    newRow.인도자이름 = safe(cols, 5);
                } else if (['합', '섭', '복', '예정', '센확'].includes(단계)) {
                    newRow.인도자지역 = safe(cols, 2);
                    newRow.인도자팀 = safe(cols, 3);
                    newRow.인도자이름 = safe(cols, 4);

                    const hasTeacher = (safe(cols, 5) || safe(cols, 6) || safe(cols, 7)) && cols.length >= 8;

                    if (hasTeacher) {
                        newRow.교사지역 = safe(cols, 5);
                        newRow.교사팀 = safe(cols, 6);
                        newRow.교사이름 = safe(cols, 7);
                        newRow.target = safe(cols, 8);
                    } else {
                        newRow.교사지역 = '';
                        newRow.교사팀 = '';
                        newRow.교사이름 = '';
                        newRow.target = safe(cols, 5); // 위치 조정
                    }
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
        if (isSaveDisabled) {
            setError('새벽 12시부터 1시까지는 superAdmin만 저장할 수 있습니다.');
            return;
        }

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
            // 기존에 단계가 없는 빈 행에는 에러 메시지를 표시하지 않음 (유지)
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
                // 동명이인 선택 모달이 뜬 경우가 아니면 일반 에러로 처리
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

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <Spin size="large" />
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <Alert
                    message="접근 권한 없음"
                    description="이 페이지에 접근할 수 있는 권한이 없습니다. 관리자에게 문의하세요."
                    type="error"
                    showIcon
                />
                <Link href="/student/view">
                    <Button
                        type="primary"
                        style={{ marginTop: '20px' }}
                    >
                        수강생 조회 페이지로 돌아가기
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="sticky top-0 z-10 bg-white pb-2 pt-4 flex gap-2 border-b border-gray-300">
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
                    <div className="min-w-[200px] whitespace-pre-line">
                        {error && (
                            <Alert
                                message={error}
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
                                message="새벽 12시부터 1시까지는 superAdmin만 저장할 수 있습니다."
                                type="warning"
                                showIcon
                            />
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Spin spinning={loading}>
                    <table
                        className="border-collapse border border-slate-400"
                        onPaste={handlePaste}
                    >
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
