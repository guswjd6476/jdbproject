'use client';

import React, { useState, useMemo } from 'react';
import { Table, Select, Typography, Space, Spin, DatePicker, Button, Card, Statistic } from 'antd';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js';
import dayjs, { Dayjs } from 'dayjs';
import { useStudentsQuery, Students } from '@/app/hook/useStudentsQuery';
import { REGIONS, STEPS, fixedTeams } from '@/app/lib/types';

const { Title } = Typography;
const { RangePicker } = DatePicker;
type 단계 = 'A' | 'B' | 'C' | 'D-1' | 'D-2' | 'E' | 'F';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export default function StudentProgressDashboard() {
    const { data: students = [], isLoading } = useStudentsQuery();
    const [selectedYear, setSelectedYear] = useState<number>(dayjs().year());
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);

    const yearOptions = [dayjs().year() - 1, dayjs().year(), dayjs().year() + 1].map((y) => ({
        value: y,
        label: `${y}년`,
    }));

    const getTeamName = (team?: string | null): string => {
        if (!team) return '기타팀';
        const prefix = team.split('-')[0];
        return fixedTeams.find((t) => t.startsWith(prefix)) ?? '기타팀';
    };

    // Student table data
    const tableData = useMemo(() => {
        return students
            .filter((student: Students) => {
                const 지역 = (student.인도자지역 ?? '').trim();
                const 팀 = getTeamName(student.인도자팀);
                const lastStepDate = student[student.단계?.toLowerCase() as keyof Students] as string | null;

                if (selectedRegion && 지역 !== selectedRegion) return false;
                if (selectedTeam && 팀 !== selectedTeam) return false;
                if (dateRange[0] && dateRange[1] && lastStepDate) {
                    const date = dayjs(lastStepDate);
                    return date.isValid() && date.isBetween(dateRange[0], dateRange[1], 'day', '[]');
                }
                return true;
            })
            .map((student: Students) => {
                const currentStep = student.단계 ?? '없음';
                const lastStepDate = student[currentStep.toLowerCase() as keyof Students] as string | null;
                const status = student.g ? '탈락' : STEPS.includes(currentStep as 단계) ? '진행중' : '미정';
                return {
                    key: student.번호?.toString() ?? 'unknown',
                    번호: student.번호,
                    이름: student.이름,
                    지역: student.인도자지역 ?? '미지정',
                    팀: getTeamName(student.인도자팀),
                    현재단계: currentStep,
                    진행상태: status,
                    마지막업데이트: lastStepDate ? dayjs(lastStepDate).format('YYYY.MM.DD') : '-',
                };
            });
    }, [students, selectedRegion, selectedTeam, dateRange, getTeamName]);

    // Trend analysis data
    const trendData = useMemo(() => {
        const monthlyData: Record<
            string,
            { completed: number; total: number; transitionDays: number[]; count: number }
        > = {};

        students.forEach((student: Students) => {
            const 지역 = (student.인도자지역 ?? '').trim();
            const 팀 = getTeamName(student.인도자팀);
            if (selectedRegion && 지역 !== selectedRegion) return;
            if (selectedTeam && 팀 !== selectedTeam) return;

            STEPS.forEach((step, index) => {
                const dateStr = student[step.toLowerCase() as keyof Students] as string | null;
                if (!dateStr) return;
                const date = dayjs(dateStr);
                if (!date.isValid() || date.year() !== selectedYear) return;
                if (dateRange[0] && dateRange[1] && !date.isBetween(dateRange[0], dateRange[1], 'day', '[]')) return;

                const month = date.format('YYYY-MM');
                monthlyData[month] = monthlyData[month] ?? { completed: 0, total: 0, transitionDays: [], count: 0 };

                monthlyData[month].total += 1;
                if (step === 'F') monthlyData[month].completed += 1;

                // Calculate transition days between steps
                if (index > 0) {
                    const prevStep = STEPS[index - 1].toLowerCase() as keyof Students;
                    const prevDateStr = student[prevStep] as string | null;
                    if (prevDateStr) {
                        const prevDate = dayjs(prevDateStr);
                        if (prevDate.isValid()) {
                            const days = date.diff(prevDate, 'day');
                            monthlyData[month].transitionDays.push(days);
                            monthlyData[month].count += 1;
                        }
                    }
                }
            });
        });

        return Object.entries(monthlyData)
            .map(([month, data]) => ({
                month,
                completionRate: data.total > 0 ? (data.completed / data.total) * 100 : 0,
                averageTransitionDays: data.count > 0 ? data.transitionDays.reduce((a, b) => a + b, 0) / data.count : 0,
            }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }, [students, selectedYear, selectedRegion, selectedTeam, dateRange]);

    // Chart data for trends
    const chartData = useMemo(
        () => ({
            labels: trendData.map((d) => d.month),
            datasets: [
                {
                    label: 'F 단계 완료율 (%)',
                    data: trendData.map((d) => d.completionRate.toFixed(2)),
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    fill: true,
                },
                {
                    label: '평균 단계 전환 일수',
                    data: trendData.map((d) => d.averageTransitionDays.toFixed(2)),
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    fill: true,
                },
            ],
        }),
        [trendData]
    );

    const chartOptions = {
        scales: {
            y: {
                beginAtZero: true,
                title: { display: true, text: '값' },
            },
            x: {
                title: { display: true, text: '월' },
            },
        },
        plugins: {
            legend: { position: 'top' as const },
            title: {
                display: true,
                text: `${selectedYear}년 학생 진행 추세`,
            },
        },
    };

    const columns = [
        { title: '번호', dataIndex: '번호', key: '번호', width: 80 },
        { title: '이름', dataIndex: '이름', key: '이름', width: 120 },
        { title: '지역', dataIndex: '지역', key: '지역', width: 100 },
        { title: '팀', dataIndex: '팀', key: '팀', width: 100 },
        { title: '현재 단계', dataIndex: '현재단계', key: '현재단계', width: 100 },
        { title: '진행 상태', dataIndex: '진행상태', key: '진행상태', width: 100 },
        { title: '마지막 업데이트', dataIndex: '마지막업데이트', key: '마지막업데이트', width: 120 },
    ];

    // KPIs
    const kpis = useMemo(() => {
        const totalStudents = tableData.length;
        const completedStudents = tableData.filter((row) => row.현재단계 === 'F').length;
        const dropoutStudents = tableData.filter((row) => row.진행상태 === '탈락').length;
        const completionRate = totalStudents > 0 ? (completedStudents / totalStudents) * 100 : 0;
        const dropoutRate = totalStudents > 0 ? (dropoutStudents / totalStudents) * 100 : 0;

        return { totalStudents, completedStudents, dropoutRate, completionRate };
    }, [tableData]);

    const handleReset = () => {
        setSelectedYear(dayjs().year());
        setSelectedRegion(null);
        setSelectedTeam(null);
        setDateRange([null, null]);
    };

    return (
        <div className="w-full mx-auto p-6">
            <Title level={2}>학생 진행 현황 대시보드</Title>

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
                    <RangePicker
                        value={dateRange}
                        onChange={(dates) => setDateRange(dates ?? [null, null])}
                        disabledDate={(current) => current && current.year() !== selectedYear}
                        format="YYYY.MM.DD"
                    />
                    <Button onClick={handleReset}>초기화</Button>
                </Space>
            </Space>

            <>
                <Spin spinning={isLoading} tip="데이터를 불러오는 중입니다...">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <Card>
                            <Statistic title="총 학생 수" value={kpis.totalStudents} />
                        </Card>
                        <Card>
                            <Statistic title="F 단계 완료" value={kpis.completedStudents} />
                        </Card>
                        <Card>
                            <Statistic
                                title="완료율 (%)"
                                value={kpis.completionRate.toFixed(2)}
                                precision={2}
                                suffix="%"
                            />
                        </Card>
                        <Card>
                            <Statistic
                                title="탈락률 (%)"
                                value={kpis.dropoutRate.toFixed(2)}
                                precision={2}
                                suffix="%"
                            />
                        </Card>
                    </div>

                    {/* Trend Chart */}
                    <Card title="월별 진행 추세" className="mb-6">
                        <Line data={chartData} options={chartOptions} />
                    </Card>

                    {/* Student Table */}
                    <Table
                        columns={columns}
                        dataSource={tableData}
                        pagination={{ pageSize: 10 }}
                        scroll={{ x: 'max-content' }}
                        bordered
                        size="middle"
                    />
                </Spin>
            </>
        </div>
    );
}
