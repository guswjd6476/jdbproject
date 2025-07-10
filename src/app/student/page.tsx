'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Table, Select, Typography, Space, Spin, Button } from 'antd';
import dayjs from 'dayjs';
import { useStudentsQuery } from '@/app/hook/useStudentsQuery';
import { REGIONS, TableRow } from '@/app/lib/types';
import type { STEP2 } from '@/app/lib/types';
import { STEPS2 } from '@/app/lib/types';

const { Title } = Typography;

export default function DashboardPage() {
    const { data: students = [], isLoading } = useStudentsQuery();

    const [selectedYear, setSelectedYear] = useState<number>(dayjs().year());
    const [selectedTargetMonth, setSelectedTargetMonth] = useState<number | null>(null);

    const monthOptions = Array.from({ length: 12 }, (_, i) => ({ label: `${i + 1}월`, value: i + 1 }));
    const yearOptions = [dayjs().year() - 1, dayjs().year(), dayjs().year() + 1].map((y) => ({
        value: y,
        label: `${y}년`,
    }));

    const regionTeamsMap = useMemo(() => {
        const map: Record<string, Set<string>> = {};
        students.forEach((s) => {
            const 지역들 = [(s.인도자지역 ?? '').trim(), (s.교사지역 ?? '').trim()];
            const 팀들 = [(s.인도자팀 ?? '').replace(/\s/g, ''), (s.교사팀 ?? '').replace(/\s/g, '')];

            지역들.forEach((지역, i) => {
                if (!REGIONS.includes(지역)) return;
                const 팀원본 = 팀들[i];
                if (!팀원본) return;
                const 팀 = 팀원본.includes('-') ? 팀원본.split('-')[0] : 팀원본;

                if (!map[지역]) map[지역] = new Set<string>();
                map[지역].add(팀);
            });
        });
        return map;
    }, [students]);

    const { tableData, totalRow } = useMemo(() => {
        const 보유건Map: Record<string, number> = {};
        const 점수Map_AB: Record<string, number> = {};
        const 점수Map_CF: Record<string, { indo: number; teacher: number }> = {};

        students.forEach((s) => {
            const 인도자지역 = (s.인도자지역 ?? '').trim();
            const 교사지역 = (s.교사지역 ?? '').trim();
            const 인도자팀 = (s.인도자팀 ?? '').replace(/\s/g, '');
            const 교사팀 = (s.교사팀 ?? '').replace(/\s/g, '');

            const currentStep = (s.단계 ?? '').toUpperCase();
            if (!STEPS2.includes(currentStep as STEP2)) return;

            const cleanTarget = (s.target ?? '').replace(/\s/g, '');
            const selectedMonthStr = selectedTargetMonth !== null ? `${selectedTargetMonth}월` : null;
            const stepIsCF = ['C', 'D-1', 'D-2', 'E', 'F'].includes(currentStep);

            if (stepIsCF && selectedMonthStr !== null && cleanTarget !== selectedMonthStr) return;

            if (stepIsCF) {
                if (REGIONS.includes(인도자지역) && 인도자팀) {
                    const 팀 = 인도자팀.includes('-') ? 인도자팀.split('-')[0] : 인도자팀;
                    const 점수key = `${인도자지역}-${팀}`;
                    if (!점수Map_CF[점수key]) 점수Map_CF[점수key] = { indo: 0, teacher: 0 };
                    점수Map_CF[점수key].indo += 0.5;

                    const 보유key = `${인도자지역}-${팀}-${currentStep}`;
                    보유건Map[보유key] = (보유건Map[보유key] ?? 0) + 1;
                }

                if (REGIONS.includes(교사지역) && 교사팀) {
                    const 팀 = 교사팀.includes('-') ? 교사팀.split('-')[0] : 교사팀;
                    const 점수key = `${교사지역}-${팀}`;
                    if (!점수Map_CF[점수key]) 점수Map_CF[점수key] = { indo: 0, teacher: 0 };
                    점수Map_CF[점수key].teacher += 0.5;

                    const 보유key = `${교사지역}-${팀}-${currentStep}`;
                    보유건Map[보유key] = (보유건Map[보유key] ?? 0) + 1;
                }
            } else if (['A', 'B'].includes(currentStep)) {
                if (REGIONS.includes(인도자지역) && 인도자팀) {
                    const 팀 = 인도자팀.includes('-') ? 인도자팀.split('-')[0] : 인도자팀;
                    const 점수key = `${인도자지역}-${팀}`;
                    점수Map_AB[점수key] = (점수Map_AB[점수key] ?? 0) + 1;

                    const 보유key = `${인도자지역}-${팀}-${currentStep}`;
                    보유건Map[보유key] = (보유건Map[보유key] ?? 0) + 1;
                }
            }
        });

        const tableData: TableRow[] = [];

        REGIONS.forEach((region) => {
            const teams = regionTeamsMap[region];
            if (!teams) return;

            teams.forEach((team) => {
                const abScore = 점수Map_AB[`${region}-${team}`] ?? 0;
                const cfScoreObj = 점수Map_CF[`${region}-${team}`] ?? { indo: 0, teacher: 0 };
                const cfScore = cfScoreObj.indo + cfScoreObj.teacher;

                const row: TableRow = {
                    key: `${selectedTargetMonth !== null ? selectedTargetMonth : '전체'}-${region}-${team}`,
                    월: selectedTargetMonth !== null ? `${selectedTargetMonth}월` : '전체',
                    지역: region,
                    팀: team,
                    탈락: 0,
                    ...STEPS2.reduce((acc, step) => {
                        const 보유key = `${region}-${team}-${step}`;
                        return {
                            ...acc,
                            [step]: ['A', 'B'].includes(step) ? abScore : cfScore,
                            [`${step}_보유`]: 보유건Map[보유key] ?? 0,
                        };
                    }, {}),
                };

                tableData.push(row);
            });
        });

        const totalRow: TableRow = {
            key: 'total',
            월: '전체 합계',
            지역: '',
            팀: '',
            탈락: 0,
            ...STEPS2.reduce((acc, step) => ({ ...acc, [step]: 0, [`${step}_보유`]: 0 }), {}),
        };

        tableData.forEach((row) => {
            STEPS2.forEach((step) => {
                totalRow[step] = Number(totalRow[step] ?? 0) + Number(row[step] ?? 0);
                totalRow[`${step}_보유`] = Number(totalRow[`${step}_보유`] ?? 0) + Number(row[`${step}_보유`] ?? 0);
            });
        });

        return { tableData, totalRow };
    }, [students, regionTeamsMap, selectedTargetMonth]);

    const [renderData, setRenderData] = useState<TableRow[]>([]);

    useEffect(() => {
        setRenderData([...tableData, totalRow]);
    }, [tableData, totalRow]);

    return (
        <div className="w-full mx-auto p-6">
            <Title level={2}>개강 점검</Title>

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
                        onChange={(v) => setSelectedYear(v)}
                        style={{ width: 100 }}
                        options={yearOptions}
                    />
                    <Select
                        placeholder="월 선택"
                        allowClear
                        style={{ width: 100 }}
                        value={selectedTargetMonth ?? undefined}
                        onChange={(v) => setSelectedTargetMonth(v ?? null)}
                        options={monthOptions}
                    />
                    <Button
                        onClick={() => {
                            setSelectedYear(dayjs().year());
                            setSelectedTargetMonth(null);
                        }}
                    >
                        초기화
                    </Button>
                </Space>

                <Spin
                    spinning={isLoading}
                    tip="데이터를 불러오는 중입니다..."
                >
                    <Table<TableRow>
                        columns={[
                            { title: '지역', dataIndex: '지역', key: 'region', fixed: 'left', width: 100 },
                            { title: '팀', dataIndex: '팀', key: 'team', fixed: 'left', width: 100 },
                            ...STEPS2.flatMap((step) => [
                                {
                                    title: `${step}`,
                                    dataIndex: `${step}_보유`,
                                    key: `${step}_보유`,
                                    width: 80,
                                    onCell: () => ({
                                        style: {
                                            backgroundColor: '#d9f7be',
                                            textAlign: 'center' as const,
                                            padding: '8px',
                                        },
                                    }),
                                },
                            ]),
                        ]}
                        dataSource={renderData}
                        scroll={{ x: 'max-content' }}
                        pagination={{ pageSize: 50 }}
                        sticky
                    />
                </Spin>
            </Space>
        </div>
    );
}
