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
        return ['타지파', '타부서', '수강생', '타지역'].some((kw) => team.includes(kw));
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
    ): Promise<boolean> {
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
            if (!res.ok) return false;
            const json = await res.json();
            return json.exists === true;
        } catch {
            return false;
        }
    }

    async function validatePreviousStageForSubmit(row: Student, allRows: Student[]): Promise<string[]> {
        const errors: string[] = [];

        const stage = row.단계.trim().toUpperCase();

        if (!단계순서.includes(stage)) {
            errors.push('유효한 단계가 아닙니다.');
            return errors;
        }

        if (!row.이름.trim()) {
            errors.push('이름이 필요합니다.');
            return errors;
        }

        if (stage === '탈락') {
            let alreadyExistsInDB = false;
            if (row.인도자지역.trim() && row.인도자팀.trim() && row.인도자이름.trim()) {
                alreadyExistsInDB = await checkPreviousStageExists(
                    row.이름.trim(),
                    '탈락',
                    row.인도자지역,
                    row.인도자팀,
                    row.인도자이름,
                    '',
                    '',
                    ''
                );
            } else if (row.교사지역.trim() && row.교사팀.trim() && row.교사이름.trim()) {
                alreadyExistsInDB = await checkPreviousStageExists(
                    row.이름.trim(),
                    '탈락',
                    '',
                    '',
                    '',
                    row.교사지역,
                    row.교사팀,
                    row.교사이름
                );
            }

            if (alreadyExistsInDB) {
                errors.push('이미 탈락으로 등록된 학생입니다.');
            }

            const hasFullIndo = row.인도자지역.trim() && row.인도자팀.trim() && row.인도자이름.trim();
            const hasFullTeacher = row.교사지역.trim() && row.교사팀.trim() && row.교사이름.trim();

            if (!hasFullIndo && !hasFullTeacher) {
                errors.push('탈락 시 인도자 정보 또는 교사 정보(지역, 팀, 이름)가 모두 필요합니다.');
            }

            return errors;
        }

        const currentStageIndex = 단계순서.indexOf(stage);
        if (currentStageIndex > 0) {
            const previousStage = 단계순서[currentStageIndex - 1];

            const previousExistsInUI = allRows.some(
                (r) => r.이름.trim() === row.이름.trim() && r.단계.trim().toUpperCase() === previousStage
            );

            const previousExistsInDB = await checkPreviousStageExists(
                row.이름.trim(),
                previousStage,
                row.인도자지역,
                row.인도자팀,
                row.인도자이름,
                row.교사지역,
                row.교사팀,
                row.교사이름
            );

            if (!previousExistsInUI && !previousExistsInDB) {
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
            if (!skip && (!row.교사지역.trim() || !row.교사팀.trim() || !row.교사이름.trim())) {
                errors.push('C~F단계는 교사 정보(지역, 팀, 이름)가 필요합니다.');
            }
        }

        return errors;
    }

    function validateRow(row: Student, allRows: Student[]): string[] {
        const errors: string[] = [];
        const stage = row.단계.trim().toUpperCase();

        if (!단계순서.includes(stage)) errors.push('유효한 단계가 아닙니다.');

        if (stage === '탈락') {
            const duplicate = allRows.filter(
                (r) => r.이름.trim() === row.이름.trim() && r.단계.trim().toUpperCase() === '탈락'
            );
            if (duplicate.length > 1) {
                errors.push('이미 탈락 처리된 수강생입니다.');
            }
            return errors;
        }

        if (!row.이름.trim()) errors.push('이름이 필요합니다.');
        if (stage === 'A' && !row.연락처.trim()) errors.push('A단계는 연락처 뒷자리 또는 온라인 아이디가 필요합니다.');
        if (stage === 'B' && !row.생년월일.trim()) errors.push('B단계는 생년월일이 필요합니다.');
        if (['C', 'D-1', 'D-2', 'E', 'F'].includes(stage)) {
            const skip = isSkipTeamCheck(row.교사팀);
            if (!skip && (!row.교사지역.trim() || !row.교사팀.trim() || !row.교사이름.trim())) {
                errors.push('C~F단계는 교사 정보(지역, 팀, 이름)가 필요합니다.');
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
        const rows = paste.split('\n').filter((r) => r.trim() !== '');
        const parsed = rows.map((row) => row.split(/\t|\//));

        setData((prev) => {
            const newData = [...prev];
            let writeIndex = newData.findIndex((r) => r.단계 === '');

            parsed.forEach((cols) => {
                if (writeIndex < 0 || writeIndex >= newData.length) return;

                const 단계 = safe(cols, 0)?.toUpperCase();
                const 이름 = safe(cols, 1);

                const newRow: Student = {
                    ...initialRow,
                    단계,
                    이름,
                };

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

            setErrorsData((prevErrors) => {
                const newErrors = [...prevErrors];
                for (let i = 0; i < newData.length; i++) {
                    newErrors[i] = validateRow(newData[i], newData);
                }
                return newErrors;
            });

            return newData;
        });
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        const filledRows = data.filter((row) => row.단계.trim() !== '');

        try {
            const res = await fetch('/api/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: filledRows, dryRun: true }),
            });
            const result = await res.json();
            if (!res.ok || !result.success) throw new Error(result.message);

            setSummaryList(result.summary); // 저장될 목록 세팅
            setConfirmVisible(true); // 모달 열기
        } catch (err: any) {
            setError(err.message || '서버 오류 발생');
        } finally {
            setLoading(false);
        }
    };
    const handleFinalSubmit = async () => {
        setLoading(true);
        setConfirmVisible(false);
        const filledRows = data.filter((row) => row.단계.trim() !== '');
        try {
            const res = await fetch('/api/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: filledRows, dryRun: false }), // ✅ dryRun: false
            });
            const result = await res.json();
            if (!res.ok || !result.success) throw new Error(result.message);
            setSuccess('최종 저장이 완료되었습니다.');
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
