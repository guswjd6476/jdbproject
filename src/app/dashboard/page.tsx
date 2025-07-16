'use client';

import React, { useState, useMemo } from 'react';
import { Table, Select, Typography, Space, Spin, Button, Card } from 'antd';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import dayjs from 'dayjs';
import { useStudentsQuery, Students } from '@/app/hook/useStudentsQuery';

const { Title } = Typography;
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const REGION_ORDER = ['도봉', '성북', '노원', '중랑', '강북', '대학', '새신자'];

export default function SentungSummaryDashboard() {
    const { data: students = [], isLoading } = useStudentsQuery();
    const [selectedYear, setSelectedYear] = useState<number>(dayjs().year());
    const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

    const yearOptions = [dayjs().year() - 1, dayjs().year(), dayjs().year() + 1].map((y) => ({
        value: y,
        label: `${y}년`,
    }));

    const sentungSummary = useMemo(() => {
        const summary: Record<string, Record<number, { guide: number; teacher: number }>> = {};
        students.forEach((student: Students) => {
            const 단계 = student.단계 ?? '';
            if (!단계.includes('센등')) return;

            const match = 단계.match(/(\d{4})년\s*(\d{1,2})월/);
            if (!match) return;
            const [_, yearStr, monthStr] = match;
            const year = Number(yearStr);
            const month = Number(monthStr);
            if (year !== selectedYear) return;

            const guideRegion = (student.인도자지역 ?? '').trim();
            const teacherRegion = (student.교사지역 ?? '').trim();

            const skipRegions = ['국제영어', '국제중국어'];
            if (skipRegions.includes(guideRegion) && skipRegions.includes(teacherRegion)) return;

            if (guideRegion && !skipRegions.includes(guideRegion)) {
                if (!summary[guideRegion]) summary[guideRegion] = {};
                if (!summary[guideRegion][month]) summary[guideRegion][month] = { guide: 0, teacher: 0 };
                summary[guideRegion][month].guide++;
            }

            if (teacherRegion && !skipRegions.includes(teacherRegion)) {
                if (!summary[teacherRegion]) summary[teacherRegion] = {};
                if (!summary[teacherRegion][month]) summary[teacherRegion][month] = { guide: 0, teacher: 0 };
                summary[teacherRegion][month].teacher++;
            }
        });

        // 정렬된 순서로 객체 재정렬
        const ordered: typeof summary = {};
        REGION_ORDER.forEach((r) => {
            if (summary[r]) ordered[r] = summary[r];
        });
        return ordered;
    }, [students, selectedYear]);

    const dataSource = useMemo(() => {
        const rows = Object.entries(sentungSummary).map(([region, monthly]) => {
            const row: any = { key: region, 지역: region, 총합: 0 };
            let total = 0;
            for (let m = 1; m <= 12; m++) {
                const guide = monthly[m]?.guide ?? 0;
                const teacher = monthly[m]?.teacher ?? 0;
                const sum = guide + teacher;
                total += sum;
                row[`month${m}_guide`] = guide;
                row[`month${m}_teacher`] = teacher;
                row[`month${m}_total`] = sum;
            }
            row.총합 = total;
            return row;
        });

        const totalRow: any = { key: '총합', 지역: '총합', 총합: 0 };
        for (let m = 1; m <= 12; m++) {
            let gSum = 0,
                tSum = 0,
                all = 0;
            rows.forEach((r) => {
                gSum += r[`month${m}_guide`] ?? 0;
                tSum += r[`month${m}_teacher`] ?? 0;
                all += r[`month${m}_total`] ?? 0;
            });
            totalRow[`month${m}_guide`] = gSum;
            totalRow[`month${m}_teacher`] = tSum;
            totalRow[`month${m}_total`] = all;
            totalRow.총합 += all;
        }
        return [...rows, totalRow];
    }, [sentungSummary]);

    const columns = useMemo(() => {
        const monthColumns = Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            return {
                title: `${m}월`,
                children: [
                    { title: '인도', dataIndex: `month${m}_guide`, key: `month${m}_guide`, width: 60 },
                    { title: '교사', dataIndex: `month${m}_teacher`, key: `month${m}_teacher`, width: 60 },
                    { title: '총합', dataIndex: `month${m}_total`, key: `month${m}_total`, width: 60 },
                ],
            };
        });
        return [
            { title: '지역', dataIndex: '지역', key: '지역', width: 100 },
            ...monthColumns,
            { title: '총합', dataIndex: '총합', key: '총합', width: 80 },
        ];
    }, []);

    const chartData = useMemo(() => {
        const labels = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);
        const regions = Object.keys(sentungSummary);
        const datasets = regions.map((region, idx) => {
            const data = labels.map((_, i) => {
                const month = i + 1;
                const guide = sentungSummary[region][month]?.guide ?? 0;
                const teacher = sentungSummary[region][month]?.teacher ?? 0;
                return guide + teacher;
            });
            return {
                label: region,
                data,
                backgroundColor: `hsl(${(idx * 360) / regions.length}, 70%, 60%)`,
            };
        });
        return { labels, datasets };
    }, [sentungSummary]);

    return (
        <div className="w-full mx-auto p-6">
            <Title level={2}>지역별 센등자 현황</Title>
            <Space
                wrap
                style={{ marginBottom: 24 }}
            >
                <Select
                    value={selectedYear}
                    onChange={setSelectedYear}
                    options={yearOptions}
                    style={{ width: 120 }}
                />
                <Button onClick={() => setViewMode('table')}>표로 보기</Button>
                <Button onClick={() => setViewMode('chart')}>그래프로 보기</Button>
            </Space>

            <Spin
                spinning={isLoading}
                tip="로딩 중..."
            >
                {viewMode === 'table' ? (
                    <Table
                        columns={columns as any}
                        dataSource={dataSource}
                        bordered
                        pagination={false}
                        scroll={{ x: 'max-content' }}
                        size="small"
                    />
                ) : (
                    <Card>
                        <Bar
                            data={chartData}
                            options={{
                                responsive: true,
                                plugins: {
                                    legend: { position: 'top' },
                                    title: {
                                        display: true,
                                        text: `${selectedYear}년 지역별 월별 센등자 건수`,
                                    },
                                },
                            }}
                        />
                    </Card>
                )}
            </Spin>
        </div>
    );
}
