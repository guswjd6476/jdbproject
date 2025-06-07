'use client';
import React, { useState } from 'react';
import { Student } from '@/app/lib/types';

import TableHeader from './TableHeader';
import TableRow from './TableRow';
import AddRowButton from './AddRowButton';
import { Card, CardContent } from '../ui/Card';

// Student 타입이 아래와 같이 확장되어야 합니다.
// export interface Student {
//   단계: string;
//   이름: string;
//   연락처: string;
//   생년월일: string;
//   인도자지역: string;
//   인도자팀: string;
//   인도자이름: string;
//   교사지역: string;
//   교사님: string;
//   교사이름: string;
// }

const initialRow: Student = {
    단계: '',
    이름: '',
    연락처: '',
    생년월일: '',
    인도자지역: '',
    인도자팀: '',
    인도자이름: '',
    교사지역: '',
    교사님: '',
    교사이름: '',
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
                    교사님: cols[8] || '',
                    교사이름: cols[9] || '',
                };
            });
            return newData;
        });
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">수강생 리스트</h1>
            <Card>
                <CardContent className="overflow-x-auto">
                    <table className="min-w-full table-auto border border-gray-300">
                        <TableHeader />
                        <tbody onPaste={handlePaste}>
                            {data.map((row, i) => (
                                <TableRow
                                    key={i}
                                    index={i}
                                    row={row}
                                    onChange={handleChange}
                                />
                            ))}
                        </tbody>
                    </table>
                </CardContent>
            </Card>
            <div className="mt-4">
                <AddRowButton onClick={addRows} />
            </div>
        </div>
    );
}
