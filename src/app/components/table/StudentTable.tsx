'use client';
import React, { useState } from 'react';
import { Student } from '@/app/lib/types';

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
    id: '',
    인도자_고유번호: null,
    교사_고유번호: null,
};

export default function StudentTable() {
    const [data, setData] = useState<Student[]>(Array.from({ length: 20 }, () => ({ ...initialRow })));

    const handleChange = (index: number, field: keyof Student, value: string) => {
        setData((prev) => {
            const newData = [...prev];
            newData[index] = { ...newData[index], [field]: value };
            return newData;
        });
    };

    const addRows = () => {
        setData((prev) => [...prev, ...Array.from({ length: 10 }, () => ({ ...initialRow }))]);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTableSectionElement>) => {
        e.preventDefault();
        const paste = e.clipboardData.getData('text');
        const rows = paste.split('\n').filter((r) => r.trim() !== '');

        // 탭 또는 슬래시 구분자 인식
        const parsed = rows.map((row) => row.split(/[\t\/]/));

        setData((prev) => {
            const newData = [...prev];
            parsed.forEach((cols, rowIndex) => {
                if (rowIndex >= newData.length) newData.push({ ...initialRow });

                newData[rowIndex] = {
                    단계: cols[0] || '',
                    이름: cols[1] || '',
                    연락처: cols[2] || '',
                    생년월일: cols[3] || '',
                    인도자지역: cols[4] || '',
                    인도자팀: cols[5] || '',
                    인도자이름: cols[6] || '',
                    교사지역: cols[7] || '',
                    교사팀: cols[8] || '',
                    교사이름: cols[9] || '',
                    id: '', // 초기값
                    인도자_고유번호: null,
                    교사_고유번호: null,
                };
            });
            return newData;
        });
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">수강생 리스트</h1>
            <Card>
                {/* CardContent에 className 직접 전달이 타입 에러 발생하면 div로 래핑 */}
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="min-w-full table-auto border border-gray-300">
                            <TableHeader />
                            <tbody onPaste={handlePaste}>
                                {data.map((row, i) => (
                                    <TableRow
                                        key={i}
                                        index={i}
                                        row={row}
                                        onChange={handleChange}
                                        errors={[]}
                                        selectStages={[]}
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
