'use client';
import React, { useState } from 'react';
import TableHeader from './table/TableHeader';
import TableRow from './table/TableRow';
import AddRowButton from './table/AddRowButton';
import { Card, CardContent } from '../components/ui/Card';
import { Student } from '../lib/types';

const INITIAL_ROWS = 20;
const ADDITIONAL_ROWS = 10;
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

export default function StudentTracker() {
    const [data, setData] = useState<Student[]>(Array.from({ length: INITIAL_ROWS }, () => ({ ...initialRow })));

    const handleChange = (index: number, field: keyof Student, value: string) => {
        setData((prev) => {
            const newData = [...prev];
            newData[index] = { ...newData[index], [field]: value };
            return newData;
        });
    };

    const addRows = () => {
        setData((prev) => [...prev, ...Array.from({ length: ADDITIONAL_ROWS }, () => ({ ...initialRow }))]);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTableSectionElement>) => {
        e.preventDefault();
        const paste = e.clipboardData.getData('text');
        const rows = paste.split('\n').filter((r) => r.trim() !== '');

        const parsed = rows.map((row) => row.split(/[\t\/]/));

        setData((prev) => {
            const newData = [...prev];

            parsed.forEach((cols, i) => {
                if (i >= newData.length) {
                    newData.push({ ...initialRow });
                }
                const type = cols[0];
                switch (type) {
                    case 'A':
                        newData[i] = {
                            ...newData[i],
                            단계: cols[0] || '',
                            이름: cols[1] || '',
                            연락처: cols[2] || '',
                            생년월일: '',
                            인도자지역: cols[3] || '',
                            인도자팀: cols[4] || '',
                            인도자이름: cols[5] || '',
                            교사지역: '',
                            교사님: '',
                            교사이름: '',
                        };
                        break;
                    case 'B':
                        newData[i] = {
                            ...newData[i],
                            단계: cols[0] || '',
                            이름: cols[1] || '',
                            연락처: '',
                            생년월일: cols[2] || '',
                            인도자지역: cols[3] || '',
                            인도자팀: cols[4] || '',
                            인도자이름: cols[5] || '',
                            교사지역: '',
                            교사님: '',
                            교사이름: '',
                        };
                        break;
                    case 'C':
                    case 'D-1':
                    case 'D-2':
                        newData[i] = {
                            ...newData[i],
                            단계: cols[0] || '',
                            이름: cols[1] || '',
                            연락처: '',
                            생년월일: '',
                            인도자지역: cols[2] || '',
                            인도자팀: cols[3] || '',
                            인도자이름: cols[4] || '',
                            교사지역: cols[5] || '',
                            교사님: cols[6] || '',
                            교사이름: cols[7] || '',
                        };
                        break;
                    default:
                        newData[i] = { ...initialRow };
                        break;
                }
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
                            {data.map((row, index) => (
                                <TableRow
                                    key={index}
                                    index={index}
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
