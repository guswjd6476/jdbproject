'use client';

import React, { useEffect, useState } from 'react';
import { Table, Select, Typography, Space, Spin, Button, DatePicker, Radio } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';

const { Title } = Typography;

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
    g?: string | null; // 탈락일
    [key: string]: string | number | null | undefined;
}

interface TableRow {
    key: string;
    월: string;
    지역: string;
    [step: string]: string | number;
}

export default function DashboardPage() {
    const [students, setStudents] = useState<RawStudent[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedDateRange, setSelectedDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
    const [selectedYear, setSelectedYear] = useState<number>(2025);
    const [viewMode, setViewMode] = useState<'month-region' | 'region-month'>('month-region');
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
    const [filterMode, setFilterMode] = useState<'month' | 'range'>('month');

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

    const grouped: Record<string, Record<string, Record<string, number>>> = {};

    students.forEach((s) => {
        const 지역 = (s.인도자지역 ?? '').trim();
        if (!지역순서.includes(지역)) return;

        단계목록.forEach((step) => {
            const key = step.toLowerCase();
            const dateStr = s[key];
            if (!dateStr) return;

            const date = dayjs(dateStr);
            if (!date.isValid() || date.year() !== selectedYear) return;

            if (viewMode === 'month-region') {
                if (filterMode === 'range') {
                    if (selectedDateRange[0] && selectedDateRange[1]) {
                        const start = selectedDateRange[0].startOf('day');
                        const end = selectedDateRange[1].endOf('day');
                        if (date.isBefore(start) || date.isAfter(end)) return;
                    } else return;
                } else if (filterMode === 'month') {
                    if (selectedMonth !== null && date.month() + 1 !== selectedMonth) return;
                }
            }

            const month = (date.month() + 1).toString();

            if (!grouped[month]) grouped[month] = {};
            if (!grouped[month][지역]) grouped[month][지역] = {};
            if (!grouped[month][지역][step]) grouped[month][지역][step] = 0;
            grouped[month][지역][step]++;

            if (!grouped['전체']) grouped['전체'] = {};
            if (!grouped['전체'][지역]) grouped['전체'][지역] = {};
            if (!grouped['전체'][지역][step]) grouped['전체'][지역][step] = 0;
            grouped['전체'][지역][step]++;
        });

        // 탈락자 처리 (g 필드 사용)
        const 탈락일Str = s.g;
        if (탈락일Str) {
            const 탈락일 = dayjs(탈락일Str);
            if (!탈락일.isValid() || 탈락일.year() !== selectedYear) return;

            let 마지막단계: string | null = null;
            for (let i = 단계목록.length - 1; i >= 0; i--) {
                const key = 단계목록[i].toLowerCase();
                if (s[key]) {
                    마지막단계 = 단계목록[i];
                    break;
                }
            }

            if (마지막단계) {
                const 탈락key = `${마지막단계}_탈락`;
                const month = (탈락일.month() + 1).toString();

                if (!grouped[month]) grouped[month] = {};
                if (!grouped[month][지역]) grouped[month][지역] = {};
                if (!grouped[month][지역][탈락key]) grouped[month][지역][탈락key] = 0;
                grouped[month][지역][탈락key]++;

                if (!grouped['전체']) grouped['전체'] = {};
                if (!grouped['전체'][지역]) grouped['전체'][지역] = {};
                if (!grouped['전체'][지역][탈락key]) grouped['전체'][지역][탈락key] = 0;
                grouped['전체'][지역][탈락key]++;
            }
        }
    });

    const columns: ColumnsType<TableRow> = [
        {
            title: viewMode === 'month-region' ? '지역' : '월',
            dataIndex: viewMode === 'month-region' ? '지역' : '월',
            key: 'regionOrMonth',
            fixed: 'left',
            width: 120,
        },
        ...단계목록.flatMap((step) => [
            {
                title: step,
                dataIndex: step,
                key: step,
                align: 'center' as const,
                width: 70,
                render: (count: number) => count ?? 0,
            },
            {
                title: `${step} 탈락`,
                dataIndex: `${step}_탈락`,
                key: `${step}_탈락`,
                align: 'center' as const,
                width: 80,
                render: (count: number) => count ?? 0,
            },
        ]),
    ];

    const tableData: TableRow[] = [];

    if (viewMode === 'month-region') {
        const makeRow = (month: string, region: string, steps: Record<string, number>) => ({
            key: `${month}-${region}`,
            월: month === '전체' ? '전체 합산' : `${month}월`,
            지역: region,
            ...단계목록.reduce((acc, step) => {
                acc[step] = steps[step] ?? 0;
                acc[`${step}_탈락`] = steps[`${step}_탈락`] ?? 0;
                return acc;
            }, {} as Record<string, number>),
        });

        const months =
            filterMode === 'range' && selectedDateRange[0] && selectedDateRange[1]
                ? Object.keys(grouped)
                      .filter((m) => m !== '전체')
                      .filter((m) => {
                          const mNum = parseInt(m);
                          const start = selectedDateRange[0]!.month() + 1;
                          const end = selectedDateRange[1]!.month() + 1;
                          return mNum >= start && mNum <= end;
                      })
                : selectedMonth
                ? [selectedMonth.toString()]
                : ['전체'];

        months.forEach((month) => {
            const monthData = grouped[month] || {};
            const regions = 지역순서.filter((r) => monthData[r]);
            regions.forEach((region) => {
                tableData.push(makeRow(month, region, monthData[region]));
            });
        });
    } else {
        const regions = selectedRegion ? [selectedRegion] : ['전체'];

        regions.forEach((region) => {
            monthOptions.forEach((m) => {
                const month = m.toString();
                const steps: Record<string, number> = {};

                if (selectedRegion) {
                    const data = grouped[month]?.[region] || {};
                    [...단계목록, ...단계목록.map((s) => `${s}_탈락`)].forEach((step) => {
                        steps[step] = data[step] ?? 0;
                    });
                } else {
                    const monthData = grouped[month] || {};
                    Object.entries(monthData).forEach(([regionName, regionData]) => {
                        if (!지역순서.includes(regionName)) return;
                        [...단계목록, ...단계목록.map((s) => `${s}_탈락`)].forEach((step) => {
                            steps[step] = (steps[step] ?? 0) + (regionData[step] ?? 0);
                        });
                    });
                }

                tableData.push({
                    key: `${region}-${month}`,
                    월: `${month}월`,
                    지역: region,
                    ...steps,
                });
            });
        });
    }

    return (
        <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
            <Title level={2} style={{ marginBottom: 20 }}>
                {viewMode === 'month-region' ? '월별 · 지역별 ' : '지역별 · 월별 '}
            </Title>

            <Space direction="vertical" size="middle" style={{ marginBottom: 20, width: '100%' }}>
                <Space wrap size="middle">
                    <Select
                        value={selectedYear}
                        onChange={(v) => setSelectedYear(v)}
                        style={{ width: 100 }}
                        options={yearOptions.map((y) => ({ value: y, label: `${y}년` }))}
                    />

                    <Space>
                        <Button
                            type={viewMode === 'month-region' ? 'primary' : 'default'}
                            onClick={() => setViewMode('month-region')}
                        >
                            월별 - 지역별
                        </Button>
                        <Button
                            type={viewMode === 'region-month' ? 'primary' : 'default'}
                            onClick={() => setViewMode('region-month')}
                        >
                            지역별 - 월별
                        </Button>
                    </Space>

                    {viewMode === 'month-region' && (
                        <>
                            <Radio.Group
                                onChange={(e) => {
                                    const val = e.target.value as 'month' | 'range';
                                    setFilterMode(val);
                                    setSelectedMonth(null);
                                    setSelectedDateRange([null, null]);
                                }}
                                value={filterMode}
                                optionType="button"
                                buttonStyle="solid"
                            >
                                <Radio.Button value="month">월 선택</Radio.Button>
                                <Radio.Button value="range">날짜 구간 선택</Radio.Button>
                            </Radio.Group>

                            {filterMode === 'month' && (
                                <Select
                                    placeholder="월 선택"
                                    allowClear
                                    style={{ width: 100 }}
                                    value={selectedMonth ?? undefined}
                                    onChange={(v) => setSelectedMonth(v ?? null)}
                                    options={monthOptions.map((m) => ({ value: m, label: `${m}월` }))}
                                />
                            )}

                            {filterMode === 'range' && (
                                <DatePicker.RangePicker
                                    value={selectedDateRange}
                                    onChange={(range) => setSelectedDateRange(range ?? [null, null])}
                                    format="YYYY.MM.DD"
                                    style={{ minWidth: 260 }}
                                    allowClear
                                />
                            )}
                        </>
                    )}

                    {viewMode === 'region-month' && (
                        <Select
                            placeholder="지역 선택"
                            allowClear
                            style={{ width: 120 }}
                            value={selectedRegion ?? undefined}
                            onChange={(v) => setSelectedRegion(v ?? null)}
                            options={['전체', ...지역순서].map((r) => ({ value: r, label: r }))}
                        />
                    )}
                </Space>
            </Space>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                    <Spin size="large" />
                </div>
            ) : (
                <Table<TableRow>
                    columns={columns}
                    dataSource={tableData}
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    size="middle"
                    bordered
                />
            )}
        </div>
    );
}
