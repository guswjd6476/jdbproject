'use client';

import React, { useState, useMemo } from 'react';
import { Table, Select, Typography, Space, Spin, Radio, DatePicker, Button, Alert } from 'antd';
import type { SortOrder } from 'antd/es/table/interface';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { useStudentsQuery } from '@/app/hook/useStudentsQuery';
import { useUser } from '@/app/hook/useUser';
import { STEPS, REGIONS, fixedTeams, Student, TableRow, STEP } from '@/app/lib/types';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Link from 'next/link';

const { Title } = Typography;
const { RangePicker } = DatePicker;

export default function DashboardPage() {
    // ✨ 1. useUser 훅에서 최신 상태 값들을 가져옵니다.
    const { region: userRegion, role, isLoading: isUserLoading } = useUser();
    const isSuperAdmin = role === 'superAdmin';

    const { data: students = [], isLoading: isStudentsLoading } = useStudentsQuery();

    const [selectedYear, setSelectedYear] = useState<number>(dayjs().year());
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
    // ✨ 수정된 부분: 지역 계정의 '구역' 선택을 위한 별도 상태 추가
    const [selectedGuyeok, setSelectedGuyeok] = useState<string | null>(null);

    const [filterMode, setFilterMode] = useState<'month' | 'range'>('month');
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
    const [selectedDateRange, setSelectedDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);

    const monthOptions = Array.from({ length: 12 }, (_, i) => ({ label: `${i + 1}월`, value: i + 1 }));
    const yearOptions = [dayjs().year() - 1, dayjs().year(), dayjs().year() + 1].map((y) => ({
        value: y,
        label: `${y}년`,
    }));

    const { tableData, totalRow } = useMemo(() => {
        const grouped: Record<string, Record<string, Record<string, Record<string, number>>>> = {};
        const 보유건Map: Record<string, number> = {};
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

        students.forEach((s) => {
            const leader지역 = (s.인도자지역 ?? '').trim();
            const leaderRaw구역 = (s.인도자팀 ?? '').trim();
            const leader구역 = leaderRaw구역;
            const leader팀 = leaderRaw구역.includes('-') ? leaderRaw구역.split('-')[0] : leaderRaw구역;

            if (!REGIONS.includes(leader지역) || !fixedTeams.includes(leader팀)) return;

            if (!isSuperAdmin) {
                // 지역 계정일 경우
                if (selectedTeam && leader팀 !== selectedTeam) return;
                // ✨ 수정된 부분: '구역' 필터링에 별도 상태(selectedGuyeok) 사용
                if (selectedGuyeok && leader구역 !== selectedGuyeok) return;
            } else {
                // 최고 관리자일 경우
                if (selectedRegion && leader지역 !== selectedRegion) return;
                if (selectedTeam && leader팀 !== selectedTeam) return;
            }

            const currentStep = (s.단계 ?? '').toUpperCase();
            if (STEPS.includes(currentStep as STEP)) {
                const key = !isSuperAdmin
                    ? `${leader팀}-${leader구역}-${currentStep}`
                    : `${leader지역}-${leader팀}-${currentStep}`;
                보유건Map[key] = (보유건Map[key] ?? 0) + 1;
            }

            STEPS.forEach((step) => {
                const key = step.toLowerCase() as keyof Student;
                const dateStr = s[key] as string | null | undefined;
                if (!dateStr) return;

                const date = dayjs(dateStr);
                if (!date.isValid()) return;

                // ✨ 수정된 부분: 기간 필터링 로직 수정
                if (filterMode === 'month') {
                    if (
                        date.year() !== selectedYear ||
                        (selectedMonth !== null && date.month() + 1 !== selectedMonth)
                    ) {
                        return;
                    }
                } else if (filterMode === 'range' && selectedDateRange[0] && selectedDateRange[1]) {
                    if (date.isBefore(selectedDateRange[0], 'day') || date.isAfter(selectedDateRange[1], 'day')) {
                        return;
                    }
                }

                const month = (date.month() + 1).toString();
                const teacherBasedSteps: STEP[] = ['섭', '복', '예정'];
                const useTeacherData = teacherBasedSteps.includes(step);

                const target지역 = useTeacherData ? (s.교사지역 ?? '').trim() : (s.인도자지역 ?? '').trim();
                const targetRaw팀 = useTeacherData ? (s.교사팀 ?? '').trim() : (s.인도자팀 ?? '').trim();
                const target팀 = targetRaw팀.includes('-') ? targetRaw팀.split('-')[0] : targetRaw팀;
                const target구역 = targetRaw팀;
                const 점수 = 1;

                const targets = [{ 지역: target지역, 팀: target팀, 구역: target구역, 점수 }];

                targets.forEach(({ 지역, 팀, 구역, 점수 }) => {
                    if (!REGIONS.includes(지역) || !fixedTeams.includes(팀)) return;

                    if (!(month in grouped)) grouped[month] = {};

                    if (!isSuperAdmin) {
                        grouped[month][팀] = grouped[month][팀] ?? {};
                        grouped[month][팀][구역] = grouped[month][팀][구역] ?? {};
                        grouped[month][팀][구역][step] = (grouped[month][팀][구역][step] ?? 0) + 점수;

                        grouped['전체'] = grouped['전체'] ?? {};
                        grouped['전체'][팀] = grouped['전체'][팀] ?? {};
                        grouped['전체'][팀][구역] = grouped['전체'][팀][구역] ?? {};
                        grouped['전체'][팀][구역][step] = (grouped['전체'][팀][구역][step] ?? 0) + 점수;
                    } else {
                        grouped[month][지역] = grouped[month][지역] ?? {};
                        grouped[month][지역][팀] = grouped[month][지역][팀] ?? {};
                        grouped[month][지역][팀][step] = (grouped[month][지역][팀][step] ?? 0) + 점수;

                        grouped['전체'] = grouped['전체'] ?? {};
                        grouped['전체'][지역] = grouped['전체'][지역] ?? {};
                        grouped['전체'][지역][팀] = grouped['전체'][지역][팀] ?? {};
                        grouped['전체'][지역][팀][step] = (grouped['전체'][지역][팀][step] ?? 0) + 점수;
                    }
                });
            });

            const 탈락일Str = s.g;
            if (탈락일Str) {
                const 탈락일 = dayjs(탈락일Str);
                if (!탈락일.isValid()) return;

                // ✨ 수정된 부분: 탈락일 기간 필터링 로직 수정
                if (filterMode === 'month') {
                    if (
                        탈락일.year() !== selectedYear ||
                        (selectedMonth !== null && 탈락일.month() + 1 !== selectedMonth)
                    ) {
                        return;
                    }
                } else if (filterMode === 'range' && selectedDateRange[0] && selectedDateRange[1]) {
                    if (탈락일.isBefore(selectedDateRange[0], 'day') || 탈락일.isAfter(selectedDateRange[1], 'day')) {
                        return;
                    }
                }

                const month = (탈락일.month() + 1).toString();
                let 마지막단계: STEP | null = null;
                for (let i = STEPS.length - 1; i >= 0; i--) {
                    const key = STEPS[i].toLowerCase() as keyof Student;
                    if (s[key]) {
                        마지막단계 = STEPS[i];
                        break;
                    }
                }

                if (마지막단계) {
                    const 탈락key = `${마지막단계}_탈락`;
                    if (!(month in grouped)) grouped[month] = {};

                    if (!isSuperAdmin) {
                        if (!grouped[month][leader팀]) grouped[month][leader팀] = {};
                        if (!grouped[month][leader팀][leader구역]) grouped[month][leader팀][leader구역] = {};
                        grouped[month][leader팀][leader구역][탈락key] =
                            (grouped[month][leader팀][leader구역][탈락key] ?? 0) + 1;
                        grouped[month][leader팀][leader구역]['탈락'] =
                            (grouped[month][leader팀][leader구역]['탈락'] ?? 0) + 1;

                        grouped['전체'] = grouped['전체'] ?? {};
                        grouped['전체'][leader팀] = grouped['전체'][leader팀] ?? {};
                        grouped['전체'][leader팀][leader구역] = grouped['전체'][leader팀][leader구역] ?? {};
                        grouped['전체'][leader팀][leader구역][탈락key] =
                            (grouped['전체'][leader팀][leader구역][탈락key] ?? 0) + 1;
                        grouped['전체'][leader팀][leader구역]['탈락'] =
                            (grouped['전체'][leader팀][leader구역]['탈락'] ?? 0) + 1;
                    } else {
                        if (!grouped[month][leader지역]) grouped[month][leader지역] = {};
                        if (!grouped[month][leader지역][leader팀]) grouped[month][leader지역][leader팀] = {};
                        grouped[month][leader지역][leader팀][탈락key] =
                            (grouped[month][leader지역][leader팀][탈락key] ?? 0) + 1;
                        grouped[month][leader지역][leader팀]['탈락'] =
                            (grouped[month][leader지역][leader팀]['탈락'] ?? 0) + 1;

                        grouped['전체'] = grouped['전체'] ?? {};
                        grouped['전체'][leader지역] = grouped['전체'][leader지역] ?? {};
                        grouped['전체'][leader지역][leader팀] = grouped['전체'][leader지역][leader팀] ?? {};
                        grouped['전체'][leader지역][leader팀][탈락key] =
                            (grouped['전체'][leader지역][leader팀][탈락key] ?? 0) + 1;
                        grouped['전체'][leader지역][leader팀]['탈락'] =
                            (grouped['전체'][leader지역][leader팀]['탈락'] ?? 0) + 1;
                    }
                }
            }
        });

        const tableData: TableRow[] = [];
        monthsToShow.forEach((month) => {
            if (!isSuperAdmin) {
                const teams = selectedTeam ? [selectedTeam] : Object.keys(grouped[month] ?? {});
                teams.forEach((team) => {
                    // ✨ 수정된 부분: '구역' 목록 생성 시 별도 상태(selectedGuyeok) 사용
                    const 구역들 = selectedGuyeok ? [selectedGuyeok] : Object.keys(grouped[month]?.[team] ?? {});
                    구역들.forEach((구역) => {
                        const stepData = grouped[month]?.[team]?.[구역] || {};
                        const row: TableRow = {
                            key: `${month}-${team}-${구역}`,
                            월: month === '전체' ? '전체 합계' : `${month}월`,
                            지역: '',
                            팀: team,
                            구역,
                            재적: 0,
                            탈락: stepData['탈락'] ?? 0,
                            ...STEPS.reduce((acc, step) => {
                                const 보유key = `${team}-${구역}-${step}`;
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
            } else {
                const regions = selectedRegion ? [selectedRegion] : REGIONS.filter((r) => Boolean(grouped[month]?.[r]));
                regions.forEach((region) => {
                    const teams = selectedTeam
                        ? [selectedTeam]
                        : fixedTeams.filter((t) => Boolean(grouped[month]?.[region]?.[t]));
                    teams.forEach((team) => {
                        const stepData = grouped[month]?.[region]?.[team] || {};
                        const row: TableRow = {
                            key: `${month}-${region}-${team}`,
                            월: month === '전체' ? '전체 합계' : `${month}월`,
                            지역: region,
                            팀: team,
                            재적: 0,
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
            }
        });

        const totalRow: TableRow = {
            key: 'total',
            월: '전체 합계',
            재적: 0,
            지역: '',
            팀: '',
            구역: '',
            탈락: 0,
            ...STEPS.reduce((acc, step) => ({ ...acc, [step]: 0, [`${step}_탈락`]: 0, [`${step}_보유`]: 0 }), {}),
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
        // ✨ 수정된 부분: 의존성 배열에 selectedGuyeok 추가
    }, [
        students,
        selectedYear,
        selectedRegion,
        selectedTeam,
        filterMode,
        selectedMonth,
        selectedDateRange,
        isSuperAdmin,
        selectedGuyeok,
    ]);

    const columns: ColumnsType<TableRow> = [
        { title: '월', dataIndex: '월', key: 'month', fixed: 'left' as const, width: 80 },
        ...(!isSuperAdmin
            ? [
                  {
                      title: '팀',
                      dataIndex: '팀',
                      key: 'team',
                      fixed: 'left' as const,
                      width: 100,
                      sorter: (a: TableRow, b: TableRow) => a.팀.localeCompare(b.팀),
                      sortDirections: ['ascend', 'descend'] as SortOrder[],
                  },
                  {
                      title: '구역',
                      dataIndex: '구역',
                      key: '구역',
                      fixed: 'left' as const,
                      width: 100,
                      sorter: (a: TableRow, b: TableRow) =>
                          (a.구역 ?? '').toString().localeCompare((b.구역 ?? '').toString()),
                      sortDirections: ['ascend', 'descend'] as SortOrder[],
                  },
              ]
            : [
                  { title: '지역', dataIndex: '지역', key: 'region', fixed: 'left' as const, width: 100 },
                  { title: '팀', dataIndex: '팀', key: 'team', fixed: 'left' as const, width: 100 },
              ]),
        ...STEPS.flatMap((step) => [
            { title: step, dataIndex: step, key: step, width: 70 },
            { title: `${step}_탈락`, dataIndex: `${step}_탈락`, key: `${step}_탈락`, width: 80 },
            {
                title: `${step}_보유`,
                dataIndex: `${step}_보유`,
                key: `${step}_보유`,
                width: 80,
                onCell: () => ({ style: { backgroundColor: '#d9f7be', textAlign: 'center' as const, padding: '8px' } }),
            },
        ]),
        { title: '탈락', dataIndex: '탈락', key: '탈락', align: 'center' as const, width: 80 },
    ];

    const handleReset = () => {
        setSelectedYear(dayjs().year());
        setSelectedRegion(null);
        setSelectedTeam(null);
        // ✨ 수정된 부분: '구역' 상태 초기화 추가
        setSelectedGuyeok(null);
        setFilterMode('month');
        setSelectedMonth(null);
        setSelectedDateRange([null, null]);
    };

    const handleExportToExcel = () => {
        const dataToExport = [...tableData, totalRow].map((row) => {
            const newRow: any = { 월: row.월 };
            if (!isSuperAdmin) {
                newRow['팀'] = row.팀;
                newRow['구역'] = row.구역;
            } else {
                newRow['지역'] = row.지역;
                newRow['팀'] = row.팀;
            }
            STEPS.forEach((step) => {
                newRow[step] = row[step];
                newRow[`${step}_탈락`] = row[`${step}_탈락`];
                newRow[`${step}_보유`] = row[`${step}_보유`];
            });
            newRow['탈락'] = row.탈락;
            return newRow;
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Dashboard');
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
        saveAs(data, 'dashboard_data.xlsx');
    };

    if (isUserLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div className="w-full mx-auto p-6">
            <Title level={2}>월별 · 지역별 · 팀별 대시보드</Title>
            <Space
                direction="vertical"
                size="large"
                style={{ marginBottom: 24, width: '100%' }}
            >
                <Space
                    wrap
                    size="middle"
                >
                    <Select
                        value={selectedYear}
                        onChange={setSelectedYear}
                        style={{ width: 100 }}
                        options={yearOptions}
                    />
                    {isSuperAdmin && (
                        <Select
                            placeholder="지역 선택"
                            allowClear
                            style={{ width: 120 }}
                            value={selectedRegion ?? undefined}
                            onChange={(v) => setSelectedRegion(v ?? null)}
                            options={REGIONS.map((r) => ({ label: r, value: r }))}
                        />
                    )}
                    <Select
                        placeholder="팀 선택"
                        allowClear
                        style={{ width: 120 }}
                        value={selectedTeam ?? undefined}
                        onChange={(v) => setSelectedTeam(v ?? null)}
                        options={fixedTeams.map((t) => ({ label: t, value: t }))}
                    />

                    {/* ✨ 수정된 부분: '구역' 선택 필터가 별도의 상태를 사용하도록 변경 */}
                    {!isSuperAdmin && (
                        <Select
                            placeholder="구역 선택"
                            allowClear
                            style={{ width: 120 }}
                            value={selectedGuyeok ?? undefined}
                            onChange={(v) => setSelectedGuyeok(v ?? null)}
                            options={[
                                ...new Set(students.map((s) => (s.인도자팀 ?? '').trim()).filter((v) => v !== '')),
                            ].map((q) => ({ label: q, value: q }))}
                        />
                    )}

                    <Radio.Group
                        onChange={(e) => {
                            setFilterMode(e.target.value);
                            setSelectedMonth(null);
                            setSelectedDateRange([null, null]);
                        }}
                        value={filterMode}
                    >
                        <Radio.Button value="month">월별</Radio.Button>
                        <Radio.Button value="range">기간별</Radio.Button>
                    </Radio.Group>

                    {filterMode === 'month' && (
                        <Select
                            placeholder="월 선택"
                            allowClear
                            style={{ width: 100 }}
                            value={selectedMonth ?? undefined}
                            onChange={(v) => setSelectedMonth(v ?? null)}
                            options={monthOptions}
                        />
                    )}
                    {filterMode === 'range' && (
                        <RangePicker
                            value={selectedDateRange}
                            onChange={(dates) => setSelectedDateRange([dates?.[0] ?? null, dates?.[1] ?? null])}
                            picker="date"
                            allowClear
                        />
                    )}
                    <Button onClick={handleReset}>초기화</Button>
                    <Button
                        onClick={handleExportToExcel}
                        type="primary"
                    >
                        엑셀로 내보내기
                    </Button>
                </Space>
                <Spin
                    spinning={isStudentsLoading}
                    tip="데이터를 불러오는 중입니다..."
                >
                    <Table<TableRow>
                        columns={columns}
                        dataSource={[...tableData, totalRow]}
                        scroll={{ x: 'max-content' }}
                        pagination={{ pageSize: 50 }}
                        sticky
                    />
                </Spin>
            </Space>
        </div>
    );
}
