'use client';

import { useUser } from '@/app/hook/useUser';
import React, { useState } from 'react';
import TableHeader from './table/TableHeader';
import TableRow from './table/TableRow';
import AddRowButton from './table/AddRowButton';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Student } from '../lib/types';
import { Spin, Alert, Modal } from 'antd';

const INITIAL_ROWS = 100;
const ADDITIONAL_ROWS = 10;
const 단계순서 = ['A', 'B', 'C', 'D-1', 'D-2', 'E', 'F', '탈락'];

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

function StudentTracker() {
    const [data, setData] = useState<Student[]>(Array.from({ length: INITIAL_ROWS }, () => ({ ...initialRow })));
    const [errorsData, setErrorsData] = useState<string[][]>(Array.from({ length: INITIAL_ROWS }, () => []));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [summaryList, setSummaryList] = useState<{ 이름: string; 단계: string }[]>([]);
    const [confirmVisible, setConfirmVisible] = useState(false);

    const { isAdmin } = useUser();

    function isSkipTeamCheck(team: string): boolean {
        return ['타지파', '타부서', '수강생', '지교회'].some((kw) => team.includes(kw));
    }

    // ✨ 반환 타입을 객체로 변경
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
        // ✨ 반환 타입 수정
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
            // ✨ API가 completedToday 플래그를 반환한다고 가정
            return { exists: json.exists === true, completedToday: json.completedToday === true };
        } catch {
            return { exists: false, completedToday: false };
        }
    }

    async function validatePreviousStageForSubmit(row: Student, allRows: Student[]): Promise<string[]> {
        const errors: string[] = [];
        // stage 대문자로 변환하되 '탈락'은 그대로 비교할 것
        const stageRaw = row.단계.trim();
        const stage = stageRaw.toUpperCase() === '탈락' ? '탈락' : stageRaw.toUpperCase();

        const 단계순서 = ['A', 'B', 'C', 'D-1', 'D-2', 'E', 'F'];

        if (stage !== '탈락' && !단계순서.includes(stage)) {
            errors.push('유효한 단계가 아닙니다.');
            return errors;
        }

        if (!row.이름.trim()) {
            errors.push('이름이 필요합니다.');
            return errors;
        }

        if (stage === '탈락') {
            // ... (탈락 로직은 동일)
            return errors;
        }

        const currentStageIndex = 단계순서.indexOf(stage);
        if (currentStageIndex > 0) {
            const previousStage = 단계순서[currentStageIndex - 1];
            const existsInUI = allRows.some(
                (r) => r.이름.trim() === row.이름.trim() && r.단계.trim().toUpperCase() === previousStage
            );

            // ✨ checkPreviousStageExists의 반환 값 사용
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

            // ✨ 오늘 완료했는지 확인하는 로직 추가
            if (completedToday) {
                errors.push(`${previousStage} 단계를 오늘 완료하여 현재 단계 등록이 불가능합니다.`);
            } else if (!existsInUI && !existsInDB) {
                errors.push(`${previousStage} 단계가 먼저 등록되어야 합니다.`);
            }
        }

        if (stage === 'A' && !row.연락처.trim()) {
            errors.push('A단계는 연락처 뒷자리 또는 온라인 아이디가 필요합니다.');
        }
        if (stage === 'B' && !row.생년월일.trim()) {
            errors.push('B단계는 생년월일이 필요합니다.');
        }
        if (['C', 'D-1', 'D-2', 'E', 'F'].includes(stage)) {
            const skip = isSkipTeamCheck(row.교사팀);
            if (!skip && (!row.교사지역 || !row.교사팀 || !row.교사이름)) {
                errors.push('C~F단계는 교사 정보가 필요합니다.');
            }
        }

        return errors;
    }

    // ... (나머지 코드는 이전과 동일)
    function validateRow(row: Student, allRows: Student[]): string[] {
        const errors: string[] = [];
        const stage = row.단계.trim().toUpperCase();

        if (!단계순서.includes(stage)) errors.push('유효한 단계가 아닙니다.');
        if (!row.이름.trim()) errors.push('이름이 필요합니다.');
        if (stage === '탈락') {
            const duplicates = allRows.filter((r) => r.이름.trim() === row.이름.trim() && r.단계 === '탈락');
            if (duplicates.length > 1) {
                errors.push('이미 탈락 처리된 수강생입니다.');
            }
            return errors;
        }

        if (stage === 'A' && !row.연락처.trim()) errors.push('A단계는 연락처가 필요합니다.');
        if (stage === 'B' && !row.생년월일.trim()) errors.push('B단계는 생년월일이 필요합니다.');
        if (['C', 'D-1', 'D-2', 'E', 'F'].includes(stage)) {
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
            newData[index] = { ...newData[index], [field]: value };
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

                if (단계 === 'A') {
                    newRow.연락처 = safe(cols, 2);
                    newRow.인도자지역 = safe(cols, 3);
                    newRow.인도자팀 = safe(cols, 4);
                    newRow.인도자이름 = safe(cols, 5);
                } else if (단계 === 'B') {
                    newRow.생년월일 = safe(cols, 2);
                    newRow.인도자지역 = safe(cols, 3);
                    newRow.인도자팀 = safe(cols, 4);
                    newRow.인도자이름 = safe(cols, 5);
                } else if (['C', 'D-1', 'D-2', 'E', 'F'].includes(단계)) {
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

        // Create a flat list of promises
        const validationPromises = filledRows.map((row) => validatePreviousStageForSubmit(row, filledRows));

        // Await all promises to resolve
        const newErrorsDataArray = await Promise.all(validationPromises);

        // Map the results back to the original data structure
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
            const res = await fetch('/api/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: filledRows, dryRun: true }),
            });

            const result = await res.json();
            if (!res.ok || !result.success) throw new Error(result.message);

            setSummaryList(result.summary);
            setConfirmVisible(true);
        } catch (err: any) {
            setError(err.message || '서버 오류 발생');
        } finally {
            setLoading(false);
        }
    };

    const handleFinalSubmit = async () => {
        setLoading(true);
        setConfirmVisible(false);
        const filledRows = data.filter((r) => r.단계.trim());
        try {
            const res = await fetch('/api/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: filledRows, dryRun: false }),
            });

            const result = await res.json();
            if (!res.ok || !result.success) throw new Error(result.message);
            setSuccess('최종 저장이 완료되었습니다.');
            // 성공적으로 저장 후 데이터 초기화 또는 재로딩 로직 추가 가능
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
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
                                    selectStages={단계순서}
                                />
                            ))}
                        </tbody>
                    </table>
                </Spin>
            </CardContent>

            <Modal
                title="저장 확인"
                open={confirmVisible}
                onCancel={() => setConfirmVisible(false)}
                onOk={handleFinalSubmit}
                okText="확인"
                cancelText="취소"
                width={600}
            >
                <p>입력된 정보를 최종 저장하시겠습니까?</p>
                <div style={{ maxHeight: 300, overflowY: 'auto', marginTop: 16 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ borderBottom: '1px solid #ccc', padding: '4px' }}>이름</th>
                                <th style={{ borderBottom: '1px solid #ccc', padding: '4px' }}>단계</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summaryList.map((item, i) => (
                                <tr key={i}>
                                    <td style={{ borderBottom: '1px solid #eee', padding: '4px' }}>{item.이름}</td>
                                    <td style={{ borderBottom: '1px solid #eee', padding: '4px' }}>{item.단계}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Modal>
        </Card>
    );
}

export default StudentTracker;
