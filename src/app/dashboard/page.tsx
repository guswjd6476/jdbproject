'use client';

import React, { useEffect, useState } from 'react';
import { Table, Select, Typography, Space, Spin, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;
const { Option } = Select;

interface RawStudent {
    번호: number;
    이름: string;
    단계: string | null;
    인도자지역: string | null;
    a?: string | null;
    b?: string | null;
    c?: string | null;
    'd-1'?: string | null;
    'd-2'?: string | null;
    e?: string | null;
    f?: string | null;
    탈락?: string | null;
    [key: string]: string | number | null | undefined;
}

interface TableRow {
    key: string;
    월: string;
    지역: string;
    A: number;
    B: number;
    C: number;
    'D-1': number;
    'D-2': number;
    E: number;
    F: number;
}

export default function DashboardPage() {
    const [students, setStudents] = useState<RawStudent[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
    const [selectedYear, setSelectedYear] = useState<number>(2025);
    const [viewMode, setViewMode] = useState<'month-region' | 'region-month'>('month-region');
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

    const 단계목록 = ['A', 'B', 'C', 'D-1', 'D-2', 'E', 'F'] as const;
    const 지역순서 = ['도봉', '성북', '노원', '중랑', '강북', '대학', '새신자'];
    const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
    const yearOptions = [2024, 2025, 2026];

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const res = await fetch('/api/students');
                if (!res.ok) throw new Error('데이터를 불러오는 데 실패했습니다.');
                const raw: RawStudent[] = await res.json();
                setStudents(raw);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    type GroupKey = number | '전체';
    const grouped: Record<GroupKey, Record<string, Record<string, number>>> = {
        전체: {},
    };

    students.forEach((s) => {
        let 지역 = (s.인도자지역 ?? '').trim();
        if (!지역순서.includes(지역)) {
            지역 = '기타';
        }

        단계목록.forEach((step) => {
            const key = step.toLowerCase();
            const dateStr = s[key];
            if (!dateStr) return;

            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return;
            const year = date.getFullYear();
            const month = date.getMonth() + 1;

            if (year !== selectedYear) return;

            if (selectedMonths.length === 0 || selectedMonths.includes(month)) {
                if (!grouped[month]) grouped[month] = {};
                if (!grouped[month][지역]) grouped[month][지역] = {};
                if (!grouped[month][지역][step]) grouped[month][지역][step] = 0;
                grouped[month][지역][step]++;

                if (!grouped['전체']) grouped['전체'] = {};
                if (!grouped['전체'][지역]) grouped['전체'][지역] = {};
                if (!grouped['전체'][지역][step]) grouped['전체'][지역][step] = 0;
                grouped['전체'][지역][step]++;
            }
        });
    });

    const columns: ColumnsType<TableRow> = [
        {
            title: viewMode === 'month-region' ? '지역' : '월',
            dataIndex: viewMode === 'month-region' ? '지역' : '월',
            key: 'regionOrMonth',
            fixed: 'left',
            width: 120,
        },
        ...단계목록.map((step) => ({
            title: step,
            dataIndex: step,
            key: step,
            align: 'center' as const,
            width: 80,
            render: (count: number) => count ?? 0,
        })),
    ];

    const tableData: TableRow[] = [];

    if (viewMode === 'month-region') {
        if (selectedMonths.length === 0) {
            const 전체지역데이터 = grouped['전체'] || {};
            const allRegions = [...지역순서, '기타'].filter((r) => Object.keys(전체지역데이터).includes(r));

            allRegions.forEach((region) => {
                const steps = 전체지역데이터[region] || {};
                tableData.push({
                    key: `전체-${region}`,
                    월: '전체 합산',
                    지역: region,
                    ...단계목록.reduce((acc, step) => {
                        acc[step] = steps[step] ?? 0;
                        return acc;
                    }, {} as Record<string, number>),
                } as TableRow);
            });
        } else {
            const sortedMonths = Object.keys(grouped)
                .filter((k) => k !== '전체')
                .map(Number)
                .sort((a, b) => a - b);

            sortedMonths.forEach((month) => {
                const regionData = grouped[month];
                if (!regionData) return;

                const allRegions = [...지역순서, '기타'].filter((r) => Object.keys(regionData).includes(r));
                allRegions.forEach((region) => {
                    const steps = regionData[region] || {};
                    tableData.push({
                        key: `${month}-${region}`,
                        월: `${month}월`,
                        지역: region,
                        ...단계목록.reduce((acc, step) => {
                            acc[step] = steps[step] ?? 0;
                            return acc;
                        }, {} as Record<string, number>),
                    } as TableRow);
                });
            });
        }
    } else {
        const regionsToShow = selectedRegion ? [selectedRegion] : [...지역순서, '기타'];

        regionsToShow.forEach((region) => {
            monthOptions.forEach((month) => {
                const regionData = grouped[month]?.[region] || {};
                tableData.push({
                    key: `${region}-${month}`,
                    월: `${month}월`,
                    지역: region,
                    ...단계목록.reduce((acc, step) => {
                        acc[step] = regionData[step] ?? 0;
                        return acc;
                    }, {} as Record<string, number>),
                } as TableRow);
            });
        });
    }

    return (
        <div style={{ padding: 20, maxWidth: 1000, margin: '0 auto' }}>
            <Title level={2}>
                {viewMode === 'month-region'
                    ? '월별 · 지역별 단계별 완료 수 대시보드'
                    : '지역별 · 월별 단계별 완료 수 대시보드'}
            </Title>

            <Space direction="vertical" size="middle" style={{ marginBottom: 20, width: '100%' }}>
                <Space wrap align="center" style={{ marginBottom: 12 }}>
                    <Button
                        type={viewMode === 'month-region' ? 'primary' : 'default'}
                        onClick={() => {
                            setViewMode('month-region');
                            setSelectedRegion(null);
                        }}
                    >
                        월별 · 지역별
                    </Button>
                    <Button
                        type={viewMode === 'region-month' ? 'primary' : 'default'}
                        onClick={() => {
                            setViewMode('region-month');
                            setSelectedMonths([]);
                        }}
                    >
                        지역별 · 월별
                    </Button>
                </Space>

                <Space wrap align="center">
                    <label style={{ fontWeight: 'bold' }}>년도 선택</label>
                    <Select value={selectedYear} onChange={setSelectedYear} style={{ width: 120 }}>
                        {yearOptions.map((y) => (
                            <Option key={y} value={y}>
                                {y}년
                            </Option>
                        ))}
                    </Select>

                    {viewMode === 'month-region' && (
                        <>
                            <label style={{ fontWeight: 'bold', marginLeft: 20 }}>필터링할 월 선택</label>
                            <Select
                                mode="multiple"
                                placeholder="월 선택"
                                style={{ minWidth: 200 }}
                                value={selectedMonths}
                                onChange={(values) => setSelectedMonths(values)}
                                allowClear
                            >
                                {monthOptions.map((m) => (
                                    <Option key={m} value={m}>
                                        {m}월
                                    </Option>
                                ))}
                            </Select>
                        </>
                    )}

                    {viewMode === 'region-month' && (
                        <>
                            <label style={{ fontWeight: 'bold', marginLeft: 20 }}>지역 선택</label>
                            <Select
                                placeholder="지역 선택"
                                style={{ width: 120 }}
                                value={selectedRegion}
                                onChange={(val) => setSelectedRegion(val)}
                                allowClear
                            >
                                {[...지역순서, '기타'].map((r) => (
                                    <Option key={r} value={r}>
                                        {r}
                                    </Option>
                                ))}
                            </Select>
                        </>
                    )}
                </Space>
            </Space>

            {loading ? (
                <Spin />
            ) : tableData.length === 0 ? (
                <p>데이터가 없습니다.</p>
            ) : (
                <Table
                    columns={columns}
                    dataSource={tableData}
                    pagination={false}
                    bordered
                    scroll={{ x: 'max-content' }}
                    rowKey="key"
                />
            )}
        </div>
    );
}
