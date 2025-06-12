'use client';

import React, { useState } from 'react';
import { Table, Select, Typography, Space, Spin, Radio, DatePicker, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { useStudentsQuery, Student } from '@/app/hook/useStudentsQuery';

const { Title } = Typography;

interface TableRow {
    key: string;
    월: string;
    팀: string;
    탈락: number;
    총합?: number;
    [step: string]: string | number | undefined;
}

export default function DashboardPage() {
    const { data: students = [], isLoading } = useStudentsQuery();

    const [selectedYear, setSelectedYear] = useState<number>(2025);
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
    const [filterMode, setFilterMode] = useState<'month' | 'range'>('month');
    const [selectedDateRange, setSelectedDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);

    const 단계목록 = ['A', 'B', 'C', 'D-1', 'D-2', 'E', 'F'] as const;
    const 지역순서 = ['도봉', '성북', '노원', '중랑', '강북', '대학', '새신자'];
    const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
    const yearOptions = [2024, 2025, 2026];
    const fixedTeams = ['1팀', '2팀', '3팀', '4팀'];

    function getTeamName(region?: string): string {
        if (!region) return '기타팀';
        const prefix = region.split('-')[0];
        if (fixedTeams.some((team) => team.startsWith(prefix))) {
            return `${prefix}팀`;
        }
        return '기타팀';
    }

    const grouped: Record<string, Record<string, Record<string, number>>> = {};

    students.forEach((s) => {
        const 지역 = (s.인도자지역 ?? '').trim();

        if (selectedRegion && 지역 !== selectedRegion) return;
        if (!지역순서.includes(지역)) return;

        const 팀 = getTeamName(s.인도자팀);
        if (!fixedTeams.includes(팀)) return;

        단계목록.forEach((step) => {
            const dateStr = s[step.toLowerCase() as keyof Student];
            if (typeof dateStr !== 'string') return;

            const date = dayjs(dateStr);
            if (!date.isValid() || date.year() !== selectedYear) return;

            if (filterMode === 'month') {
                if (selectedMonth !== null && date.month() + 1 !== selectedMonth) return;
            } else if (filterMode === 'range') {
                if (selectedDateRange[0] && selectedDateRange[1]) {
                    const start = selectedDateRange[0].startOf('day');
                    const end = selectedDateRange[1].endOf('day');
                    if (date.isBefore(start) || date.isAfter(end)) return;
                } else return;
            }

            const month = (date.month() + 1).toString();

            if (!grouped[month]) grouped[month] = {};
            if (!grouped[month][팀]) grouped[month][팀] = {};
            if (!grouped[month][팀][step]) grouped[month][팀][step] = 0;
            grouped[month][팀][step]++;
        });

        if (s.dropOut) {
            // 탈락일은 f단계 날짜로 처리
            const 탈락일Str = s.f;
            if (typeof 탈락일Str === 'string') {
                const 탈락일 = dayjs(탈락일Str);
                if (!탈락일.isValid() || 탈락일.year() !== selectedYear) return;

                let 마지막단계: string | null = null;
                for (let i = 단계목록.length - 1; i >= 0; i--) {
                    const key = 단계목록[i].toLowerCase();
                    if (typeof s[key as keyof Student] === 'string') {
                        마지막단계 = 단계목록[i];
                        break;
                    }
                }
                if (마지막단계) {
                    const 탈락key = `${마지막단계}_탈락`;
                    const month = (탈락일.month() + 1).toString();

                    if (!grouped[month]) grouped[month] = {};
                    if (!grouped[month][팀]) grouped[month][팀] = {};
                    if (!grouped[month][팀][탈락key]) grouped[month][팀][탈락key] = 0;
                    grouped[month][팀][탈락key]++;
                }
            }
        }
    });

    const monthsToShow =
        filterMode === 'range' && selectedDateRange[0] && selectedDateRange[1]
            ? Array.from({ length: selectedDateRange[1]!.month() - selectedDateRange[0]!.month() + 1 }, (_, i) =>
                  (selectedDateRange[0]!.month() + 1 + i).toString()
              )
            : selectedMonth
            ? [selectedMonth.toString()]
            : Object.keys(grouped).sort((a, b) => Number(a) - Number(b));

    const tableData: TableRow[] = [];

    monthsToShow.forEach((month) => {
        fixedTeams.forEach((team) => {
            const stepData = grouped[month]?.[team] || {};
            const row: TableRow = {
                key: `${month}-${team}`,
                월: `${month}월`,
                팀: team,
                탈락: 0,
            };
            단계목록.forEach((step) => {
                row[step] = stepData[step] ?? 0;
                const dropoutKey = `${step}_탈락`;
                if (stepData[dropoutKey]) {
                    row.탈락 += stepData[dropoutKey];
                }
            });
            row['총합'] = 단계목록.reduce((acc, step) => acc + ((row[step] as number) ?? 0), 0) + row.탈락;
            tableData.push(row);
        });
    });

    const totalRow: TableRow = {
        key: 'total',
        월: '전체',
        팀: '',
        탈락: 0,
        총합: 0,
    };

    단계목록.forEach((step) => {
        totalRow[step] = tableData.reduce((sum, row) => sum + ((row[step] as number) ?? 0), 0);
    });
    totalRow.탈락 = tableData.reduce((sum, row) => sum + (row.탈락 ?? 0), 0);
    totalRow.총합 = 단계목록.reduce((sum, step) => sum + ((totalRow[step] as number) ?? 0), 0) + totalRow.탈락;

    tableData.push(totalRow);

    const columns: ColumnsType<TableRow> = [
        {
            title: '월',
            dataIndex: '월',
            key: 'month',
            fixed: 'left',
            width: 100,
        },
        {
            title: '팀',
            dataIndex: '팀',
            key: 'team',
            fixed: 'left',
            width: 120,
        },
        ...단계목록.map((step) => ({
            title: step,
            dataIndex: step,
            key: step,
            align: 'center' as const,
            width: 70,
            render: (count: number) => count ?? 0,
        })),
        {
            title: '탈락',
            dataIndex: '탈락',
            key: '탈락',
            align: 'center' as const,
            width: 80,
            render: (count: number) => count ?? 0,
        },
        {
            title: '총합',
            dataIndex: '총합',
            key: 'total',
            align: 'center' as const,
            width: 80,
            render: (count: number) => count ?? 0,
        },
    ];

    return (
        <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
            <Title level={2} style={{ marginBottom: 20 }}>
                팀별 월별 대시보드
            </Title>

            <Space direction="vertical" size="middle" style={{ marginBottom: 20, width: '100%' }}>
                <Space wrap size="middle">
                    <Select
                        value={selectedYear}
                        onChange={(v) => setSelectedYear(v)}
                        style={{ width: 100 }}
                        options={yearOptions.map((y) => ({ value: y, label: `${y}년` }))}
                    />

                    <Select
                        placeholder="지역 선택"
                        allowClear
                        style={{ width: 120 }}
                        value={selectedRegion ?? undefined}
                        onChange={(v) => setSelectedRegion(v ?? null)}
                        options={지역순서.map((r) => ({ label: r, value: r }))}
                    />

                    <Radio.Group
                        value={filterMode}
                        onChange={(e) => setFilterMode(e.target.value)}
                        options={[
                            { label: '월별 조회', value: 'month' },
                            { label: '기간 조회', value: 'range' },
                        ]}
                        optionType="button"
                        buttonStyle="solid"
                    />

                    {filterMode === 'month' && (
                        <Select
                            placeholder="월 선택"
                            allowClear
                            style={{ width: 100 }}
                            value={selectedMonth ?? undefined}
                            onChange={(v) => setSelectedMonth(v ?? null)}
                            options={monthOptions.map((m) => ({ label: `${m}월`, value: m }))}
                        />
                    )}

                    {filterMode === 'range' && (
                        <DatePicker.RangePicker
                            value={selectedDateRange}
                            onChange={(dates) => {
                                if (!dates) setSelectedDateRange([null, null]);
                                else setSelectedDateRange([dates[0], dates[1]]);
                            }}
                            picker="month"
                            format="YYYY-MM"
                            allowEmpty={[false, false]}
                            disabledDate={(current) => {
                                // 선택연도와 다른 연도 선택 방지
                                if (!current) return false;
                                return current.year() !== selectedYear;
                            }}
                        />
                    )}

                    <Button
                        onClick={() => {
                            setSelectedRegion(null);
                            setSelectedMonth(null);
                            setSelectedDateRange([null, null]);
                            setFilterMode('month');
                        }}
                    >
                        초기화
                    </Button>
                </Space>
            </Space>

            {isLoading ? (
                <Spin tip="로딩 중..." />
            ) : (
                <Table<TableRow>
                    columns={columns}
                    dataSource={tableData}
                    pagination={false}
                    bordered
                    scroll={{ x: 900 }}
                    summary={() => (
                        <Table.Summary.Row>
                            <Table.Summary.Cell index={0}>전체</Table.Summary.Cell>
                            <Table.Summary.Cell index={1} />
                            {단계목록.map((step, i) => (
                                <Table.Summary.Cell key={step} index={i + 2} align="center">
                                    {totalRow[step]}
                                </Table.Summary.Cell>
                            ))}
                            <Table.Summary.Cell index={단계목록.length + 2} align="center">
                                {totalRow.탈락}
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={단계목록.length + 3} align="center">
                                {totalRow.총합}
                            </Table.Summary.Cell>
                        </Table.Summary.Row>
                    )}
                />
            )}
        </div>
    );
}
