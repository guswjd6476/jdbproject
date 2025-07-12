'use client';

import React, { useState, useMemo } from 'react';
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
        const map: Record<string, string[]> = {};

        students.forEach((s) => {
            const 지역 = (s.인도자지역 ?? '').trim();
            if (!REGIONS.includes(지역)) return;

            const raw구역 = (s.인도자팀 ?? '').replace(/\s/g, '');
            if (!raw구역) return;

            const 팀 = raw구역.includes('-') ? raw구역.split('-')[0] : raw구역;

            if (!map[지역]) map[지역] = [];
            if (!map[지역].includes(팀)) map[지역].push(팀);
        });

        // 각 지역별 팀 정렬
        Object.keys(map).forEach((region) => {
            map[region].sort((a, b) => {
                const numA = parseInt(a, 10);
                const numB = parseInt(b, 10);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return a.localeCompare(b);
            });
        });

        return map;
    }, [students]);

    const renderData: TableRow[] = useMemo(() => {
        const 보유건Map: Record<string, number> = {};
        const 점수Map: Record<string, number> = {};

        students.forEach((s) => {
            const 단계 = (s.단계 ?? '').toUpperCase();
            if (!STEPS2.includes(단계 as STEP2)) return;

            const isCF단계 = ['C', 'D-1', 'D-2', 'E', 'F'].includes(단계);
            const isAB단계 = ['A', 'B'].includes(단계);

            if (isCF단계 && selectedTargetMonth) {
                const targetMonth = `${selectedTargetMonth}월`;
                if (s.target?.trim() !== targetMonth) return;
            }

            const 인도자지역 = (s.인도자지역 ?? '').trim();
            const 인도자팀 = (s.인도자팀 ?? '').replace(/\s/g, '');
            const 인도자팀앞 = 인도자팀.includes('-') ? 인도자팀.split('-')[0] : 인도자팀;

            if (인도자지역 && 인도자팀앞 && REGIONS.includes(인도자지역)) {
                const key = `${인도자지역}-${인도자팀앞}-${단계}`;
                보유건Map[key] = (보유건Map[key] ?? 0) + 1;
            }

            if (isAB단계) {
                const 점수key = `${인도자지역}-${인도자팀앞}`;
                점수Map[점수key] = (점수Map[점수key] ?? 0) + 1;
            }

            if (isCF단계) {
                const 교사지역 = (s.교사지역 ?? '').trim();
                const 교사팀 = (s.교사팀 ?? '').replace(/\s/g, '');
                const 교사팀앞 = 교사팀.includes('-') ? 교사팀.split('-')[0] : 교사팀;

                const 인도자key = `${인도자지역}-${인도자팀앞}`;
                const 교사key = `${교사지역}-${교사팀앞}`;

                if (인도자지역 && 인도자팀앞 && REGIONS.includes(인도자지역)) {
                    점수Map[인도자key] = (점수Map[인도자key] ?? 0) + 0.5;
                }
                if (교사지역 && 교사팀앞 && REGIONS.includes(교사지역)) {
                    점수Map[교사key] = (점수Map[교사key] ?? 0) + 0.5;
                }
            }
        });

        const rows: TableRow[] = [];

        REGIONS.forEach((region) => {
            const teams = regionTeamsMap[region];
            if (!teams) return;

            teams.forEach((team) => {
                const keyBase = `${region}-${team}`;
                const row: TableRow = {
                    key: `${selectedTargetMonth ?? '전체'}-${region}-${team}`,
                    월: selectedTargetMonth ? `${selectedTargetMonth}월` : '전체',
                    지역: region,
                    팀: team,
                    탈락: 0,
                };

                STEPS2.forEach((step) => {
                    const 보유key = `${region}-${team}-${step}`;
                    const 점수 = 점수Map[keyBase] ?? 0;
                    row[step] = ['A', 'B'].includes(step) ? 점수 : 점수;
                    row[`${step}_보유`] = 보유건Map[보유key] ?? 0;
                });

                rows.push(row);
            });
        });

        const totalRow: TableRow = {
            key: 'total',
            월: '전체 합계',
            지역: '',
            팀: '',
            탈락: 0,
            ...Object.fromEntries(
                STEPS2.flatMap((s) => [
                    [s, 0],
                    [`${s}_보유`, 0],
                ])
            ),
        };

        rows.forEach((row) => {
            STEPS2.forEach((step) => {
                totalRow[step] = Number(totalRow[step] ?? 0) + Number(row[step] ?? 0);
                totalRow[`${step}_보유`] = Number(totalRow[`${step}_보유`] ?? 0) + Number(row[`${step}_보유`] ?? 0);
            });
        });

        return [...rows, totalRow];
    }, [students, selectedTargetMonth, regionTeamsMap]);

    return (
        <div className="w-full mx-auto p-6">
            <Title level={2}>개강 점검</Title>

            <Space direction="vertical" size="large" style={{ marginBottom: 24, width: '100%' }}>
                <Space wrap size="middle">
                    <Select
                        value={selectedYear}
                        onChange={setSelectedYear}
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

                <Spin spinning={isLoading} tip="데이터를 불러오는 중입니다...">
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
