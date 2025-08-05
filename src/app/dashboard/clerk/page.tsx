'use client';

import React, { useMemo, useState } from 'react';
import { Table, Select, Typography, Button, Spin } from 'antd';
import { useStudentsQuery } from '@/app/hook/useStudentsQuery';
import { REGIONS } from '@/app/lib/types';
import dayjs from 'dayjs';
import { exportToExcel } from '@/utills/exportToExcel';
const STEPS2 = ['발', '찾', '합', '섭', '복', '예정'] as const;
type StepType = (typeof STEPS2)[number];
const { Title } = Typography;

const isStepType = (value: string): value is StepType => {
    return (STEPS2 as readonly string[]).includes(value);
};
interface RegionRow {
    key: string;
    지역: string;
    [key: string]: string | number;
}

export default function RegionSummary() {
    const { data: students = [], isLoading } = useStudentsQuery();
    const [selectedMonth, setSelectedMonth] = useState<number | null>(dayjs().month() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(dayjs().year());

    const monthOptions = Array.from({ length: 12 }, (_, i) => ({ label: `${i + 1}월`, value: i + 1 }));
    const yearOptions = [dayjs().year() - 1, dayjs().year(), dayjs().year() + 1].map((y) => ({
        value: y,
        label: `${y}년`,
    }));

    const renderData: RegionRow[] = useMemo(() => {
        const regionMap: Record<string, RegionRow> = {};
        const targetMonthStr = selectedMonth ? `${selectedMonth}월` : null;

        students.forEach((s) => {
            const rawStep = (s.단계 ?? '').trim();

            if (!rawStep || !isStepType(rawStep)) return;

            const 단계: StepType = rawStep;
            const isLeaderHalfStep = 단계 === '합';
            const isTeacherHalfStep = ['섭', '복', '예정'].includes(단계);
            const isABStep = ['발', '찾'].includes(단계);

            let region = '';
            if (isABStep || isLeaderHalfStep) {
                region = (s.인도자지역 ?? '').trim();
            } else if (isTeacherHalfStep) {
                region = (s.교사지역 ?? '').trim();
            }

            if (!REGIONS.includes(region)) return;

            if (!regionMap[region]) {
                regionMap[region] = { key: region, 지역: region };
                STEPS2.forEach((step) => {
                    regionMap[region][`${step}_보유`] = 0;
                });
            }

            // A, B단계는 항상 포함
            if (isABStep) {
                regionMap[region][`${단계}_보유`] = (regionMap[region][`${단계}_보유`] as number) + 1;
            }

            // C, D단계는 월이 지정된 경우에만 필터링하고, 아니면 전부 포함
            if (isLeaderHalfStep || isTeacherHalfStep) {
                if (!targetMonthStr || s.target?.trim() === targetMonthStr) {
                    regionMap[region][`${단계}_보유`] = (regionMap[region][`${단계}_보유`] as number) + 1;
                }
            }
        });
        return Object.values(regionMap);
    }, [students, selectedMonth, selectedYear]);

    const handleExport = () => {
        const dataToExport = renderData.map((row) => {
            const result: any = { 지역: row.지역 };
            STEPS2.forEach((step) => {
                result[`${step}`] = row[`${step}_보유`] ?? 0;
            });
            return result;
        });
        const title = selectedMonth
            ? `${selectedYear}년_${selectedMonth}월_지역별_보유현황`
            : `${selectedYear}년_전체_지역별_보유현황`;
        exportToExcel(dataToExport, title);
    };

    return (
        <div className="w-full mx-auto p-6">
            <Title level={2}>지역별 보유 현황</Title>
            <div className="flex gap-4 mb-4">
                <Select value={selectedYear} onChange={setSelectedYear} style={{ width: 100 }} options={yearOptions} />
                <Select
                    placeholder="월 선택"
                    allowClear
                    style={{ width: 100 }}
                    value={selectedMonth ?? undefined}
                    onChange={(v) => setSelectedMonth(v ?? null)}
                    options={monthOptions}
                />
                <Button
                    onClick={() => {
                        setSelectedYear(dayjs().year());
                        setSelectedMonth(null);
                    }}
                >
                    초기화
                </Button>
                <Button onClick={handleExport}>엑셀 다운로드</Button>
            </div>
            <Spin spinning={isLoading} tip="데이터 불러오는 중...">
                <Table<RegionRow>
                    columns={[
                        {
                            title: '지역',
                            dataIndex: '지역',
                            key: '지역',
                            fixed: 'left',
                            width: 120,
                            align: 'center',
                        },
                        ...STEPS2.map((step) => ({
                            title: step,
                            dataIndex: `${step}_보유`,
                            key: `${step}_보유`,
                            width: 80,
                            align: 'center' as const,
                        })),
                    ]}
                    dataSource={renderData}
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                />
            </Spin>
        </div>
    );
}
