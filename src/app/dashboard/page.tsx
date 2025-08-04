'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Table, InputNumber, Input, Button, Typography, message, Space } from 'antd';
import { useUser } from '@/app/hook/useUser';

interface RowData {
    month: number;
    region: string;
    발: number;
    찾: number;
    합: number;
    섭: number;
    복: number;
    예정: number;
    센확: number;
    센등: number;
    발To찾?: number;
    찾To합?: number;
    합To섭?: number;
    섭To복?: number;
    복To예정?: number;
    isTotal?: boolean;
}

const INITIAL_ROW = (month: number): RowData => ({
    month,
    region: '',
    발: 0,
    찾: 0,
    합: 0,
    섭: 0,
    복: 0,
    예정: 0,
    센확: 0,
    센등: 0,
});

function MultiRegionInputForm({ month, onSubmit }: { month: number; onSubmit: (rows: RowData[]) => void }) {
    const [rows, setRows] = useState<RowData[]>([INITIAL_ROW(month)]);

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
                                {['발', '찾', '합', '섭', '복', '예정', '센확', '센등'].map((key) => (
                                    <td className="border p-1" key={key}>
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
                <Button type="primary" onClick={handleSubmit}>
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
            let sum발 = 0,
                sum찾 = 0,
                sum합 = 0,
                sum섭 = 0,
                sum복 = 0,
                sum예정 = 0,
                sum센확 = 0,
                sum센등 = 0;

            const rowsWithRates = rows.map((row) => {
                const newRow = {
                    ...row,
                    발To찾: row.발 ? (row.찾 / row.발) * 100 : 0,
                    찾To합: row.찾 ? (row.합 / row.찾) * 100 : 0,
                    합To섭: row.합 ? (row.섭 / row.합) * 100 : 0,
                    섭To복: row.복 ? (row.복 / row.섭) * 100 : 0,
                    복To예정: row.예정 ? (row.예정 / row.복) * 100 : 0,
                };
                sum발 += row.발;
                sum찾 += row.찾;
                sum합 += row.합;
                sum섭 += row.섭;
                sum복 += row.복;
                sum예정 += row.예정;
                sum센확 += row.센확;
                sum센등 += row.센등;
                return newRow;
            });

            const totalRow: RowData = {
                month,
                region: '총합',
                발: sum발,
                찾: sum찾,
                합: sum합,
                섭: sum섭,
                복: sum복,
                예정: sum예정,
                센확: sum센확,
                센등: sum센등,
                발To찾: sum발 ? (sum찾 / sum발) * 100 : 0,
                찾To합: sum찾 ? (sum합 / sum찾) * 100 : 0,
                합To섭: sum합 ? (sum섭 / sum합) * 100 : 0,
                섭To복: sum섭 ? (sum복 / sum섭) * 100 : 0,
                복To예정: sum복 ? (sum예정 / sum복) * 100 : 0,
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
        { title: '발', dataIndex: '발', width: 70 },
        { title: '찾', dataIndex: '찾', width: 60 },
        { title: '합', dataIndex: '합', width: 60 },
        { title: '섭', dataIndex: '섭', width: 60 },
        { title: '복', dataIndex: '복', width: 60 },
        { title: '예정', dataIndex: '예정', width: 60 },
        { title: '센확', dataIndex: '센확', width: 60 },
        { title: '센등', dataIndex: '센등', width: 60 },
        {
            title: '발→찾(%)',
            dataIndex: '발To찾',
            render: (v: number) => v?.toFixed(1),
        },
        {
            title: '찾→합(%)',
            dataIndex: '찾To합',
            render: (v: number) => v?.toFixed(1),
        },
        {
            title: '합→섭(%)',
            dataIndex: '합To섭',
            render: (v: number) => v?.toFixed(1),
        },
        {
            title: '섭→복(%)',
            dataIndex: '섭To복',
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
                    <MultiRegionInputForm month={selectedMonth} onSubmit={handleSaveRows} />
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
