'use client';

import React, { useState, useMemo } from 'react';
import { Table, Select, Typography, Space, Spin, Radio, DatePicker, Button } from 'antd';

import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { useStudentsQuery } from '@/app/hook/useStudentsQuery';
import { STEPS, fixedTeams, REGIONS } from '@/app/lib/types';

const { Title } = Typography;
const { RangePicker } = DatePicker;

type 단계 = 'A' | 'B' | 'C' | 'D-1' | 'D-2' | 'E' | 'F';
interface Student {
    번호: number;
    이름: string;
    단계: string | null;
    인도자지역: string | null;
    인도자팀: string | null;
    a?: string | null;
    b?: string | null;
    c?: string | null;
    'd-1'?: string | null;
    'd-2'?: string | null;
    e?: string | null;
    f?: string | null;
    g?: string | null; // 탈락일 추가
    [key: string]: string | number | null | undefined;
}

interface TableRow {
    key: string;
    월: string;
    지역: string;
    팀: string;
    탈락: number;
    [step: string]: string | number;
}

export default function DashboardPage() {
    const { data: students = [], isLoading } = useStudentsQuery();

    const [selectedYear, setSelectedYear] = useState<number>(dayjs().year());
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
    const [filterMode, setFilterMode] = useState<'month' | 'range'>('month');
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
    const [selectedDateRange, setSelectedDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);

    const monthOptions = Array.from({ length: 12 }, (_, i) => ({ label: `${i + 1}월`, value: i + 1 }));
    const yearOptions = [dayjs().year() - 1, dayjs().year(), dayjs().year() + 1].map((y) => ({
        value: y,
        label: `${y}년`,
    }));
    const getTeamName = (team?: string | null): string => {
        if (!team) return '기타팀';
        const prefix = team.split('-')[0];
        return fixedTeams.find((t) => t.startsWith(prefix)) ?? '기타팀';
    };

    const { tableData, totalRow } = useMemo(() => {
        const grouped: Record<string, Record<string, Record<string, Record<string, number>>>> = {};
        const 보유건Map: Record<string, number> = {};

        students.forEach((s) => {
            const 지역 = (s.인도자지역 ?? '').trim();
            const 팀 = getTeamName(s.인도자팀);
            if (!REGIONS.includes(지역) || !fixedTeams.includes(팀)) return;
            if (selectedRegion && 지역 !== selectedRegion) return;
            if (selectedTeam && 팀 !== selectedTeam) return;

            // 보유건 처리
            const currentStep = (s.단계 ?? '').toUpperCase();
            if (STEPS.includes(currentStep as 단계)) {
                const key = `${지역}-${팀}-${currentStep}`;
                보유건Map[key] = (보유건Map[key] ?? 0) + 1;
            }

            STEPS.forEach((step) => {
                const key = step.toLowerCase() as keyof Student;
                const dateStr = s[key] as string | null | undefined;
                if (!dateStr) return;

                const date = dayjs(dateStr);
                if (!date.isValid() || date.year() !== selectedYear) return;

                if (filterMode === 'month' && selectedMonth !== null && date.month() + 1 !== selectedMonth) return;
                if (filterMode === 'range' && selectedDateRange[0] && selectedDateRange[1]) {
                    const [start, end] = selectedDateRange;
                    if (date.isBefore(start, 'day') || date.isAfter(end, 'day')) return;
                }

                const month = (date.month() + 1).toString();
                grouped[month] = grouped[month] ?? {};
                grouped[month][지역] = grouped[month][지역] ?? {};
                grouped[month][지역][팀] = grouped[month][지역][팀] ?? {};
                grouped[month][지역][팀][step] = (grouped[month][지역][팀][step] ?? 0) + 1;

                grouped['전체'] = grouped['전체'] ?? {};
                grouped['전체'][지역] = grouped['전체'][지역] ?? {};
                grouped['전체'][지역][팀] = grouped['전체'][지역][팀] ?? {};
                grouped['전체'][지역][팀][step] = (grouped['전체'][지역][팀][step] ?? 0) + 1;
            });

            const 탈락일Str = s.g;
            if (탈락일Str) {
                const 탈락일 = dayjs(탈락일Str);
                if (!탈락일.isValid() || 탈락일.year() !== selectedYear) return;

                // 기간 필터링 탈락 건수 처리
                if (filterMode === 'month' && selectedMonth !== null) {
                    if (탈락일.month() + 1 !== selectedMonth) return;
                } else if (filterMode === 'range' && selectedDateRange[0] && selectedDateRange[1]) {
                    const [start, end] = selectedDateRange;
                    if (탈락일.isBefore(start, 'day') || 탈락일.isAfter(end, 'day')) return;
                }
                // 월 계산
                const month = (탈락일.month() + 1).toString();

                let 마지막단계: 단계 | null = null;
                for (let i = STEPS.length - 1; i >= 0; i--) {
                    const key = STEPS[i].toLowerCase() as keyof Student;
                    if (s[key]) {
                        마지막단계 = STEPS[i];
                        break;
                    }
                }
                if (마지막단계) {
                    const 탈락key = `${마지막단계}_탈락`;

                    grouped[month] = grouped[month] ?? {};
                    grouped[month][지역] = grouped[month][지역] ?? {};
                    grouped[month][지역][팀] = grouped[month][지역][팀] ?? {};
                    grouped[month][지역][팀][탈락key] = (grouped[month][지역][팀][탈락key] ?? 0) + 1;
                    grouped[month][지역][팀]['탈락'] = (grouped[month][지역][팀]['탈락'] ?? 0) + 1;

                    grouped['전체'] = grouped['전체'] ?? {};
                    grouped['전체'][지역] = grouped['전체'][지역] ?? {};
                    grouped['전체'][지역][팀] = grouped['전체'][지역][팀] ?? {};
                    grouped['전체'][지역][팀][탈락key] = (grouped['전체'][지역][팀][탈락key] ?? 0) + 1;
                    grouped['전체'][지역][팀]['탈락'] = (grouped['전체'][지역][팀]['탈락'] ?? 0) + 1;
                }
            }
        });

        const tableData: TableRow[] = [];
        let monthsToShow: string[];
        if (filterMode === 'range' && selectedDateRange[0] && selectedDateRange[1]) {
            monthsToShow = [];
            let current = selectedDateRange[0].startOf('month');
            const end = selectedDateRange[1];
            while (current.isBefore(end) || current.isSame(end, 'month')) {
                monthsToShow.push((current.month() + 1).toString());
                current = current.add(1, 'month');
            }
        } else if (filterMode === 'month' && selectedMonth) {
            monthsToShow = [selectedMonth.toString()];
        } else {
            monthsToShow = ['전체'];
        }

        monthsToShow.forEach((month) => {
            const regions = selectedRegion ? [selectedRegion] : REGIONS.filter((r) => grouped[month]?.[r]);
            regions.forEach((region) => {
                const teams = selectedTeam ? [selectedTeam] : fixedTeams.filter((t) => grouped[month]?.[region]?.[t]);
                teams.forEach((team) => {
                    const stepData = grouped[month]?.[region]?.[team] || {};
                    const row: TableRow = {
                        key: `${month}-${region}-${team}`,
                        월: month === '전체' ? '전체 합계' : `${month}월`,
                        지역: region,
                        팀: team,
                        탈락: stepData['탈락'] ?? 0,
                        ...STEPS.reduce((acc, step) => {
                            const 보유key = `${region}-${team}-${step}`;
                            return {
                                ...acc,
                                [step]: stepData[step] ?? 0,
                                [`${step}_탈락`]: stepData[`${step}_탈락`] ?? 0,
                                [`${step}_보유`]: 보유건Map[보유key] ?? 0,
                            };
                        }, {}),
                    };
                    tableData.push(row);
                });
            });
        });

        const totalRow: TableRow = {
            key: 'total',
            월: '전체 합계',
            지역: '',
            팀: '',
            탈락: 0,
            ...STEPS.reduce(
                (acc, step) => ({
                    ...acc,
                    [step]: 0,
                    [`${step}_탈락`]: 0,
                    [`${step}_보유`]: 0,
                }),
                {}
            ),
        };
        tableData.forEach((row) => {
            STEPS.forEach((step) => {
                totalRow[step] = (totalRow[step] as number) + (row[step] as number);
                totalRow[`${step}_탈락`] = (totalRow[`${step}_탈락`] as number) + (row[`${step}_탈락`] as number);
                totalRow[`${step}_보유`] = (totalRow[`${step}_보유`] as number) + (row[`${step}_보유`] as number);
            });
            totalRow.탈락 += row.탈락;
        });

        return { tableData, totalRow };
    }, [
        students,
        selectedYear,
        selectedRegion,
        selectedTeam,
        filterMode,
        selectedMonth,
        selectedDateRange,
        getTeamName,
    ]);

    const columns: ColumnsType<TableRow> = [
        { title: '월', dataIndex: '월', key: 'month', fixed: 'left', width: 80 },
        { title: '지역', dataIndex: '지역', key: 'region', fixed: 'left', width: 100 },
        { title: '팀', dataIndex: '팀', key: 'team', fixed: 'left', width: 100 },
        ...STEPS.flatMap((step) => [
            {
                title: step,
                dataIndex: step,
                key: step,
                width: 70,
            },
            {
                title: `${step}_탈락`,
                dataIndex: `${step}_탈락`,
                key: `${step}_탈락`,
                width: 80,
            },
            {
                title: `${step}_보유`,
                dataIndex: `${step}_보유`,
                key: `${step}_보유`,
                width: 80,
            },
        ]),
        { title: '탈락', dataIndex: '탈락', key: '탈락', align: 'center', width: 80 },
    ];

    const handleReset = () => {
        setSelectedYear(dayjs().year());
        setSelectedRegion(null);
        setSelectedTeam(null);
        setFilterMode('month');
        setSelectedMonth(null);
        setSelectedDateRange([null, null]);
    };

    return (
        <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
            <Title level={2}>월별 · 지역별 · 팀별 대시보드</Title>

            <Space direction="vertical" size="large" style={{ marginBottom: 24, width: '100%' }}>
                <Space wrap size="middle">
                    <Select
                        value={selectedYear}
                        onChange={setSelectedYear}
                        style={{ width: 100 }}
                        options={yearOptions}
                    />
                    <Select
                        placeholder="지역 선택"
                        allowClear
                        style={{ width: 120 }}
                        value={selectedRegion}
                        onChange={setSelectedRegion}
                        options={REGIONS.map((r) => ({ label: r, value: r }))}
                    />
                    <Select
                        placeholder="팀 선택"
                        allowClear
                        style={{ width: 120 }}
                        value={selectedTeam}
                        onChange={setSelectedTeam}
                        options={fixedTeams.map((t) => ({ label: t, value: t }))}
                    />
                    <Radio.Group
                        value={filterMode}
                        onChange={(e) => setFilterMode(e.target.value)}
                        optionType="button"
                        buttonStyle="solid"
                    >
                        <Radio.Button value="month">월별 조회</Radio.Button>
                        <Radio.Button value="range">기간 조회</Radio.Button>
                    </Radio.Group>
                    {filterMode === 'month' && (
                        <Select
                            placeholder="월 선택"
                            allowClear
                            style={{ width: 120 }}
                            value={selectedMonth}
                            onChange={setSelectedMonth}
                            options={monthOptions}
                        />
                    )}
                    {filterMode === 'range' && (
                        <RangePicker
                            value={selectedDateRange}
                            onChange={(dates) => setSelectedDateRange(dates ?? [null, null])}
                            disabledDate={(current) => current && current.year() !== selectedYear}
                            format="YYYY.MM.DD"
                        />
                    )}
                    <Button onClick={handleReset}>초기화</Button>
                </Space>
            </Space>

            {isLoading ? (
                <div style={{ textAlign: 'center', padding: 50 }}>
                    <Spin size="large" tip="데이터를 불러오는 중입니다..." />
                </div>
            ) : (
                <Table<TableRow>
                    columns={columns}
                    dataSource={tableData}
                    pagination={{ pageSize: 24, hideOnSinglePage: true }}
                    scroll={{ x: 'max-content' }}
                    bordered
                    size="middle"
                    summary={() => (
                        <Table.Summary.Row style={{ backgroundColor: '#fafafa', fontWeight: 'bold' }}>
                            <Table.Summary.Cell index={0} colSpan={3}>
                                전체 합계
                            </Table.Summary.Cell>
                            {STEPS.flatMap((step, i) => [
                                <Table.Summary.Cell key={step} index={i * 3 + 3} align="center">
                                    {totalRow[step]}
                                </Table.Summary.Cell>,
                                <Table.Summary.Cell key={`${step}_탈락`} index={i * 3 + 4} align="center">
                                    {totalRow[`${step}_탈락`]}
                                </Table.Summary.Cell>,
                                <Table.Summary.Cell key={`${step}_보유`} index={i * 3 + 5} align="center">
                                    {totalRow[`${step}_보유`]}
                                </Table.Summary.Cell>,
                            ])}
                            <Table.Summary.Cell index={STEPS.length * 3 + 3} align="center">
                                {totalRow.탈락}
                            </Table.Summary.Cell>
                        </Table.Summary.Row>
                    )}
                />
            )}
        </div>
    );
}
