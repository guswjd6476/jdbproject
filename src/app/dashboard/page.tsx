'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Table, InputNumber, Input, Button, Typography, message, Space } from 'antd';
import { useUser } from '@/app/hook/useUser';

interface RowData {
    month: number;
    region: string;
    a: number;
    b: number;
    c: number;
    d_1: number;
    d_2: number;
    f: number;
    센확: number;
    센등: number;
    aToB?: number;
    bToC?: number;
    cToD1?: number;
    d1ToF?: number;
    isTotal?: boolean;
}

const INITIAL_ROW = (month: number): RowData => ({
    month,
    region: '',
    a: 0,
    b: 0,
    c: 0,
    d_1: 0,
    d_2: 0,
    f: 0,
    센확: 0,
    센등: 0,
});

function MultiRegionInputForm({ month, onSubmit }: { month: number; onSubmit: (rows: RowData[]) => void }) {
    const [rows, setRows] = useState<RowData[]>([INITIAL_ROW(month)]);

    // month가 바뀌면 rows 초기화
    React.useEffect(() => {
        setRows([INITIAL_ROW(month)]);
    }, [month]);

    const handleChange = (index: number, key: keyof RowData, value: any) => {
        const updated = [...rows];
        (updated[index] as any)[key] = value;
        setRows(updated);
    };

    const handleAddRow = () => setRows([...rows, INITIAL_ROW(month)]);

    const handleSubmit = () => {
        const valid = rows.every((r) => r.region.trim() !== '');
        if (!valid) return message.error('모든 행의 지역을 입력하세요.');
        const withMonth = rows.map((r) => ({ ...r, month }));
        onSubmit(withMonth);
        // 제출 후 초기화
        setRows([INITIAL_ROW(month)]);
    };

    return (
        <div className="mb-6">
            <Typography.Text strong>📥 지역별 입력</Typography.Text>
            <div className="overflow-auto mt-2">
                <table className="w-full border text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-2 border">지역</th>
                            <th className="p-2 border">A</th>
                            <th className="p-2 border">B</th>
                            <th className="p-2 border">C</th>
                            <th className="p-2 border">D-1</th>
                            <th className="p-2 border">D-2</th>
                            <th className="p-2 border">F</th>
                            <th className="p-2 border">센확</th>
                            <th className="p-2 border">센등</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, idx) => (
                            <tr key={idx}>
                                <td className="border p-1">
                                    <Input
                                        value={row.region}
                                        onChange={(e) => handleChange(idx, 'region', e.target.value)}
                                    />
                                </td>
                                {['a', 'b', 'c', 'd_1', 'd_2', 'f', '센확', '센등'].map((key) => (
                                    <td
                                        className="border p-1"
                                        key={key}
                                    >
                                        <InputNumber
                                            value={row[key as keyof RowData] as number}
                                            onChange={(val) => handleChange(idx, key as keyof RowData, val || 0)}
                                            min={0}
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-2 flex gap-2">
                <Button onClick={handleAddRow}>+ 행 추가</Button>
                <Button
                    type="primary"
                    onClick={handleSubmit}
                >
                    저장
                </Button>
            </div>
        </div>
    );
}

export default function MonthlyDashboard() {
    const [data, setData] = useState<RowData[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<number>(7);
    const { isAdmin } = useUser();

    useEffect(() => {
        fetchData();
    }, []);

    // 서버에서 최신 데이터 받아오기 함수
    const fetchData = () => {
        fetch('/api/monthly')
            .then((res) => res.json())
            .then((res) => setData(res))
            .catch(() => message.error('데이터를 불러오는 데 실패했습니다.'));
    };

    const enhancedData = useMemo(() => {
        if (data.length === 0) return [];

        const monthMap: Record<number, RowData[]> = {};
        data.forEach((row) => {
            if (!monthMap[row.month]) monthMap[row.month] = [];
            monthMap[row.month].push(row);
        });

        const result: RowData[] = [];

        Object.entries(monthMap).forEach(([monthStr, rows]) => {
            const month = Number(monthStr);
            let sumA = 0,
                sumB = 0,
                sumC = 0,
                sumD1 = 0,
                sumD2 = 0,
                sumF = 0,
                sum센확 = 0,
                sum센등 = 0;

            const rowsWithRates = rows.map((row) => {
                const newRow = {
                    ...row,
                    aToB: row.a ? (row.b / row.a) * 100 : 0,
                    bToC: row.b ? (row.c / row.b) * 100 : 0,
                    cToD1: row.c ? (row.d_1 / row.c) * 100 : 0,
                    d1ToF: row.d_1 ? (row.f / row.d_1) * 100 : 0,
                };
                sumA += row.a;
                sumB += row.b;
                sumC += row.c;
                sumD1 += row.d_1;
                sumD2 += row.d_2;
                sumF += row.f;
                sum센확 += row.센확;
                sum센등 += row.센등;
                return newRow;
            });

            const totalRow: RowData = {
                month,
                region: '총합',
                a: sumA,
                b: sumB,
                c: sumC,
                d_1: sumD1,
                d_2: sumD2,
                f: sumF,
                센확: sum센확,
                센등: sum센등,
                aToB: sumA ? (sumB / sumA) * 100 : 0,
                bToC: sumB ? (sumC / sumB) * 100 : 0,
                cToD1: sumC ? (sumD1 / sumC) * 100 : 0,
                d1ToF: sumD1 ? (sumF / sumD1) * 100 : 0,
                isTotal: true,
            };

            result.push(...rowsWithRates, totalRow);
        });

        return result;
    }, [data]);

    // 수정된 부분: 여러 행을 한꺼번에 POST 요청 보내는 함수
    const handleSaveRows = async (rows: RowData[]) => {
        try {
            const res = await fetch('/api/monthly', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rows), // 배열 통째로 보내기
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '저장 실패');
            }

            message.success('저장 성공');
            fetchData();
        } catch (error: any) {
            message.error(`저장 실패: ${error.message}`);
        }
    };

    const columns = [
        { title: '월', dataIndex: 'month', sorter: (a: any, b: any) => a.month - b.month, width: 70 },
        { title: '지역', dataIndex: 'region', width: 80 },
        { title: 'A', dataIndex: 'a', width: 70 },
        { title: 'B', dataIndex: 'b', width: 60 },
        { title: 'C', dataIndex: 'c', width: 60 },
        { title: 'D-1', dataIndex: 'd_1', width: 60 },
        { title: 'D-2', dataIndex: 'd_2', width: 60 },
        { title: 'F', dataIndex: 'f', width: 60 },
        { title: '센확', dataIndex: '센확', width: 60 },
        { title: '센등', dataIndex: '센등', width: 60 },
        {
            title: 'A→B(%)',
            dataIndex: 'aToB',
            render: (v: number) => v?.toFixed(1),
        },
        {
            title: 'B→C(%)',
            dataIndex: 'bToC',
            render: (v: number) => v?.toFixed(1),
        },
        {
            title: 'C→D-1(%)',
            dataIndex: 'cToD1',
            render: (v: number) => v?.toFixed(1),
        },
        {
            title: 'D-1→F(%)',
            dataIndex: 'd1ToF',
            render: (v: number) => v?.toFixed(1),
        },
    ];

    return (
        <div className="p-12">
            <Typography.Title level={4}>📊 월별 지역별 단계별 현황</Typography.Title>

            {isAdmin && (
                <div className="mb-4">
                    <Space className="mb-2">
                        <span>입력 월:</span>
                        <InputNumber
                            min={1}
                            max={12}
                            value={selectedMonth}
                            onChange={(v) => setSelectedMonth(v || 1)}
                        />
                    </Space>
                    <MultiRegionInputForm
                        month={selectedMonth}
                        onSubmit={handleSaveRows}
                    />
                </div>
            )}

            <Table
                rowKey={(row) => `${row.month}-${row.region}-${row.isTotal ? 'total' : 'row'}`}
                dataSource={enhancedData}
                columns={columns}
                pagination={false}
                rowClassName={(row) => (row.isTotal ? 'bg-gray-100 font-semibold' : '')}
                scroll={{ y: 600 }}
                sticky
            />
        </div>
    );
}
