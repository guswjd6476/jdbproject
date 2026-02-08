'use client';

import React, { useState, useCallback } from 'react';
import { Student, STEPNAME } from '@/app/lib/types'; // STEPNAME 추가

import TableHeader from './TableHeader';
import TableRow from './TableRow';
import AddRowButton from './AddRowButton';
import { Card, CardContent } from '../ui/Card';

const initialRow: Student = {
    단계: '',
    이름: '',
    연락처: '',
    생년월일: '',
    인도자지역: '',
    인도자팀: '',
    인도자이름: '',
    교사지역: '',
    교사팀: '',
    교사이름: '',
    도구: '',
    target: '',
    id: '',
    인도자_고유번호: null,
    교사_고유번호: null,
};

export default function StudentTable() {
    const [data, setData] = useState<Student[]>(Array.from({ length: 20 }, () => ({ ...initialRow })));

    // 1. useCallback을 사용하여 불필요한 리렌더링 방지
    const handleChange = useCallback((index: number, field: keyof Student, value: string) => {
        setData((prev) => {
            const newData = [...prev];
            newData[index] = { ...newData[index], [field]: value };
            return newData;
        });
    }, []);

    // 2. 삭제 함수 추가 (TableRow의 에러 해결 핵심)
    const handleDeleteRow = useCallback((index: number) => {
        setData((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const addRows = () => {
        setData((prev) => [...prev, ...Array.from({ length: 10 }, () => ({ ...initialRow }))]);
    };

    // 3. 붙여넣기 핸들러 수정 (슬래시/탭 구분 및 캡처링 대응)
    const handlePaste = (e: React.ClipboardEvent) => {
        const paste = e.clipboardData.getData('text');
        if (!paste) return;

        // 탭이나 슬래시가 포함된 경우에만 가로채기
        if (paste.includes('\t') || paste.includes('/')) {
            e.preventDefault();

            const rows = paste.split(/\r?\n/).filter((r) => r.trim() !== '');
            const parsed = rows.map((row) => {
                const delimiter = row.includes('\t') ? '\t' : '/';
                return row.split(delimiter).map((s) => s.trim());
            });

            setData((prev) => {
                const newData = [...prev];
                // 첫 번째 비어있는 행 찾기
                let writeIndex = newData.findIndex((r) => !r.단계 && !r.이름);
                if (writeIndex === -1) writeIndex = newData.length;

                parsed.forEach((cols) => {
                    const safe = (idx: number) => cols[idx] || '';
                    const newRow: Student = {
                        ...initialRow,
                        단계: safe(0).toUpperCase(),
                        이름: safe(1),
                        연락처: safe(2),
                        생년월일: safe(3),
                        인도자지역: safe(4),
                        인도자팀: safe(5),
                        인도자이름: safe(6),
                        교사지역: safe(7),
                        교사팀: safe(8),
                        교사이름: safe(9),
                        도구: safe(10),
                        target: safe(11),
                    };

                    if (writeIndex < newData.length) {
                        newData[writeIndex] = newRow;
                    } else {
                        newData.push(newRow);
                    }
                    writeIndex++;
                });
                return newData;
            });
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">수강생 리스트</h1>
            <Card>
                <CardContent>
                    {/* CardContent 대신 여기서 이벤트를 낚아챕니다 */}
                    <div
                        className="overflow-x-auto"
                        onPasteCapture={handlePaste}
                    >
                        <table className="min-w-full table-auto border border-gray-300">
                            <TableHeader />
                            <tbody>
                                {data.map((row, i) => (
                                    <TableRow
                                        key={i}
                                        index={i}
                                        row={row}
                                        onChange={handleChange}
                                        onDelete={handleDeleteRow}
                                        errors={[]}
                                        selectStages={STEPNAME}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
            <div className="mt-4">
                <AddRowButton onClick={addRows} />
            </div>
        </div>
    );
}
