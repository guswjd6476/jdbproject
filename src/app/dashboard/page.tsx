'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Table } from 'antd';

interface RowData {
    month: number;
    region: string;
    team?: string;
    a: number;
    b: number;
    c: number;
    d_1: number;
    d_2: number;
    f: number;
    aToB?: number;
    bToC?: number;
    cToD1?: number;
    d1ToF?: number;
    isTotal?: boolean;
}

export default function MonthlyDashboard() {
    const [data, setData] = useState<RowData[]>([]);

    useEffect(() => {
        fetch('/api/monthly')
            .then((res) => res.json())
            .then((res) => setData(res));
    }, []);

    const enhancedData = useMemo(() => {
        if (data.length === 0) return [];

        // month 별로 그룹핑 (모듈 없이)
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
                sumF = 0;

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
                return newRow;
            });

            const totalRow: RowData = {
                month,
                region: '총합',
                team: '',
                a: sumA,
                b: sumB,
                c: sumC,
                d_1: sumD1,
                d_2: sumD2,
                f: sumF,
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

    const columns = [
        { title: '월', dataIndex: 'month', key: 'month', sorter: (a: any, b: any) => a.month - b.month },
        { title: '지역', dataIndex: 'region', key: 'region' },
        { title: '팀', dataIndex: 'team', key: 'team' },
        { title: 'A', dataIndex: 'a', key: 'a' },
        { title: 'B', dataIndex: 'b', key: 'b' },
        { title: 'C', dataIndex: 'c', key: 'c' },
        { title: 'D-1', dataIndex: 'd_1', key: 'd_1' },
        { title: 'D-2', dataIndex: 'd_2', key: 'd_2' },
        { title: 'F', dataIndex: 'f', key: 'f' },
        { title: '센확', dataIndex: '센확', key: '센확' },
        { title: '센등', dataIndex: '센등', key: '센등' },
        {
            title: 'A→B 향상률(%)',
            dataIndex: 'aToB',
            key: 'aToB',
            render: (v: number) => v?.toFixed(1),
        },
        {
            title: 'B→C 향상률(%)',
            dataIndex: 'bToC',
            key: 'bToC',
            render: (v: number) => v?.toFixed(1),
        },
        {
            title: 'C→D-1 향상률(%)',
            dataIndex: 'cToD1',
            key: 'cToD1',
            render: (v: number) => v?.toFixed(1),
        },
        {
            title: 'D-1→F 향상률(%)',
            dataIndex: 'd1ToF',
            key: 'd1ToF',
            render: (v: number) => v?.toFixed(1),
        },
    ];

    return (
        <div>
            <h2>📊 월별 지역별 단계별 현황</h2>
            <Table
                rowKey={(row) => `${row.month}-${row.region}-${row.team || ''}-${row.isTotal ? 'total' : 'row'}`}
                dataSource={enhancedData}
                columns={columns}
                pagination={false}
                summary={() => null}
                rowClassName={(row) => (row.isTotal ? 'bg-gray-100 font-semibold' : '')}
            />
        </div>
    );
}
