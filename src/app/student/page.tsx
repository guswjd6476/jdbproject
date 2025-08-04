'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Table, Select, Typography, Space, Spin, Button } from 'antd';
import dayjs from 'dayjs';
import { useStudentsQuery } from '@/app/hook/useStudentsQuery';
import { mondaycell, REGIONS } from '@/app/lib/types';
import type { STEP2, TableRow3 } from '@/app/lib/types';
import { STEPS2 } from '@/app/lib/types';
import { exportToExcel } from '@/utills/exportToExcel';

const { Title } = Typography;

interface Enrollment {
    지역: string;
    팀: string;
    재적: number;
}

interface RegionConfig {
    id: number;
    region: string;
    month: number;
    year: number;
    예정_goals: Record<string, string>;
}

export default function DashboardPage() {
    const { data: students = [], isLoading } = useStudentsQuery();

    const [selectedYear, setSelectedYear] = useState<number>(dayjs().year());
    const [selectedTargetMonth, setSelectedTargetMonth] = useState<number | null>(dayjs().month() + 1);
    const [enrollmentMap, setEnrollmentMap] = useState<Record<string, number>>({});
    const [regionConfigs, setRegionConfigs] = useState<RegionConfig[]>([]);

    const monthOptions = Array.from({ length: 12 }, (_, i) => ({ label: `${i + 1}월`, value: i + 1 }));
    const yearOptions = [dayjs().year() - 1, dayjs().year(), dayjs().year() + 1].map((y) => ({
        value: y,
        label: `${y}년`,
    }));

    useEffect(() => {
        const fetchEnrollment = async () => {
            try {
                const res = await fetch('/api/members');
                if (!res.ok) throw new Error('서버 응답 오류');
                const data: Enrollment[] = await res.json();
                const map: Record<string, number> = {};
                data.forEach(({ 지역, 팀, 재적 }) => {
                    map[`${지역}-${팀}`] = 재적;
                });
                setEnrollmentMap(map);
            } catch (error) {
                console.error('재적 불러오기 실패:', error);
            }
        };

        const fetchRegionConfigs = async () => {
            try {
                const res = await fetch('/api/region-configs');
                if (!res.ok) throw new Error('서버 응답 오류');
                const data: RegionConfig[] = await res.json();
                setRegionConfigs(data);
            } catch (error) {
                console.error('지역별 목표 데이터 불러오기 실패:', error);
            }
        };

        fetchEnrollment();
        fetchRegionConfigs();
    }, []);

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

    const renderData: TableRow3[] = useMemo(() => {
        const scoreMap: Record<string, number> = {};
        const lastMonthScoreMap: Record<string, number> = {};

        let lastMonthSearchTerm = '';
        if (selectedTargetMonth && selectedYear) {
            const currentMonthDate = dayjs(`${selectedYear}-${selectedTargetMonth}-01`);
            const lastMonthDate = currentMonthDate.subtract(1, 'month');
            lastMonthSearchTerm = `${lastMonthDate.year()}년 ${lastMonthDate.month() + 1}월`;
        }

        students.forEach((s) => {
            const 단계 = (s.단계 ?? '').toUpperCase().trim();
            if (!단계) return;

            if (lastMonthSearchTerm && 단계.includes('센확')) {
                const 인도자지역 = (s.인도자지역 ?? '').trim();
                const 인도자팀Raw = (s.인도자팀 ?? '').replace(/\s/g, '');
                if (인도자지역 && 인도자팀Raw && REGIONS.includes(인도자지역)) {
                    const 인도자팀 = 인도자팀Raw.includes('-') ? 인도자팀Raw.split('-')[0] : 인도자팀Raw;
                    const leaderKey = `${인도자지역}-${인도자팀}`;
                    lastMonthScoreMap[leaderKey] = (lastMonthScoreMap[leaderKey] ?? 0) + 0.5;
                }

                const 교사지역 = (s.교사지역 ?? '').trim();
                const 교사팀Raw = (s.교사팀 ?? '').replace(/\s/g, '');
                if (교사지역 && 교사팀Raw && REGIONS.includes(교사지역)) {
                    const 교사팀 = 교사팀Raw.includes('-') ? 교사팀Raw.split('-')[0] : 교사팀Raw;
                    const teacherKey = `${교사지역}-${교사팀}`;
                    lastMonthScoreMap[teacherKey] = (lastMonthScoreMap[teacherKey] ?? 0) + 0.5;
                }
            }

            if (!STEPS2.includes(단계 as STEP2)) return;
            const isCFStep = ['합', '섭', '복', '예정'].includes(단계);
            const isABStep = ['발', '찾'].includes(단계);

            if (isABStep) {
                const 인도자지역 = (s.인도자지역 ?? '').trim();
                const 인도자팀Raw = (s.인도자팀 ?? '').replace(/\s/g, '');
                if (!인도자지역 || !인도자팀Raw || !REGIONS.includes(인도자지역)) return;
                const 인도자팀 = 인도자팀Raw.includes('-') ? 인도자팀Raw.split('-')[0] : 인도자팀Raw;
                const key = `${인도자지역}-${인도자팀}-${단계}`;
                scoreMap[key] = (scoreMap[key] ?? 0) + 1;
            }

            if (isCFStep && selectedTargetMonth) {
                const targetMonth = `${selectedTargetMonth}월`;
                if (s.target?.trim() === targetMonth) {
                    const 인도자지역 = (s.인도자지역 ?? '').trim();
                    const 인도자팀Raw = (s.인도자팀 ?? '').replace(/\s/g, '');
                    if (인도자지역 && 인도자팀Raw && REGIONS.includes(인도자지역)) {
                        const 인도자팀 = 인도자팀Raw.includes('-') ? 인도자팀Raw.split('-')[0] : 인도자팀Raw;
                        const leaderKey = `${인도자지역}-${인도자팀}-${단계}`;
                        scoreMap[leaderKey] = (scoreMap[leaderKey] ?? 0) + 0.5;
                    }
                    const 교사지역 = (s.교사지역 ?? '').trim();
                    const 교사팀Raw = (s.교사팀 ?? '').replace(/\s/g, '');
                    if (교사지역 && 교사팀Raw && REGIONS.includes(교사지역)) {
                        const 교사팀 = 교사팀Raw.includes('-') ? 교사팀Raw.split('-')[0] : 교사팀Raw;
                        const teacherKey = `${교사지역}-${교사팀}-${단계}`;
                        scoreMap[teacherKey] = (scoreMap[teacherKey] ?? 0) + 0.5;
                    }
                }
            }
        });

        const rows: TableRow3[] = [];
        REGIONS.forEach((region) => {
            const teams = regionTeamsMap[region];
            if (!teams) return;
            teams.forEach((team) => {
                const keyBase = `${region}-${team}`;
                const config = regionConfigs.find(
                    (c) => c.region === region && c.year === selectedYear && c.month === selectedTargetMonth
                );
                const fGoal = config?.예정_goals?.[`team${team}`] ? parseFloat(config.예정_goals[`team${team}`]) : 0;

                const row: TableRow3 = {
                    key: `${selectedTargetMonth ?? '전체'}-${region}-${team}`,
                    월: selectedTargetMonth ? `${selectedTargetMonth}월` : '전체',
                    지역: region,
                    팀: team,
                    재적: enrollmentMap[keyBase] ?? 0,
                    예정_goal: fGoal,
                    last_month_result: lastMonthScoreMap[keyBase] ?? 0,
                    탈락: 0,
                    gospel_score: 0,
                    gospel_rate: 0,
                };

                STEPS2.forEach((step) => {
                    const scoreKey = `${region}-${team}-${step}`;
                    row[`${step}_보유`] = scoreMap[scoreKey] ?? 0;
                });

                const gospelScore =
                    Number(row['섭_보유'] ?? 0) + Number(row['복_보유'] ?? 0) + Number(row['예정_보유'] ?? 0);
                row.gospel_score = Math.round(gospelScore * 10) / 10;
                row.gospel_rate = fGoal > 0 ? Math.round((gospelScore / fGoal) * 100) : 0; // %로 표시

                if (!mondaycell.includes(`${region}-${team}`)) {
                    rows.push(row);
                }
            });
        });

        const totalRow: TableRow3 = {
            key: 'total',
            월: '전체 합계',
            지역: '',
            팀: '',
            재적: 0,
            예정_goal: 0,
            last_month_result: 0,
            탈락: 0,
            ...Object.fromEntries(STEPS2.map((s) => [`${s}_보유`, 0])),
            gospel_score: 0,
            gospel_rate: 0,
        };

        rows.forEach((row) => {
            totalRow['재적'] += Number(row['재적'] ?? 0);
            totalRow['예정_goals'] = Number(totalRow['예정_goals'] ?? 0) + Number(row['예정_goals'] ?? 0);
            totalRow['last_month_result'] =
                Number(totalRow['last_month_result'] ?? 0) + Number(row['last_month_result'] ?? 0);
            totalRow['gospel_score'] = Number(totalRow['gospel_score'] ?? 0) + Number(row['gospel_score'] ?? 0);

            STEPS2.forEach((step) => {
                totalRow[`${step}_보유`] = Number(totalRow[`${step}_보유`] ?? 0) + Number(row[`${step}_보유`] ?? 0);
            });
        });

        STEPS2.forEach((step) => {
            const totalScore = totalRow[`${step}_보유`] as number;
            totalRow[`${step}_보유`] = Math.round(totalScore * 10) / 10;
        });

        const totalFGoal = Number(totalRow['예정_goals']);
        const totalGospelScore = Number(totalRow['gospel_score']);
        totalRow['gospel_rate'] = totalFGoal > 0 ? Math.round((totalGospelScore / totalFGoal) * 100) : 0;

        return [...rows, totalRow];
    }, [students, selectedYear, selectedTargetMonth, regionTeamsMap, enrollmentMap, regionConfigs]);

    const handleExportExcel = () => {
        if (renderData.length === 0) return;
        const dataToExport = renderData.map((row) => {
            const result: any = {
                월: row.월,
                지역: row.지역,
                팀: row.팀,
                재적: row.재적,
                ...STEPS2.reduce((acc, step) => {
                    acc[step] = Number(row[`${step}_보유`] ?? 0);
                    return acc;
                }, {} as Record<string, number>),
                '개강 목표': row.예정_goals,
                '지난달 결과': row.last_month_result,
                '복음방 점수': row.gospel_score,
                '목표 달성률(%)': row.gospel_rate,
            };
            return result;
        });
        const title = selectedTargetMonth
            ? `${selectedYear}년_${selectedTargetMonth}월_개강점검`
            : `${selectedYear}년_전체_개강점검`;
        exportToExcel(dataToExport, title);
    };
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
                    <Button onClick={handleExportExcel}>엑셀 다운로드</Button>
                </Space>
                <Spin spinning={isLoading} tip="데이터를 불러오는 중입니다...">
                    <Table<TableRow3>
                        columns={[
                            {
                                title: '지역',
                                dataIndex: '지역',
                                key: 'region',
                                fixed: 'left',
                                width: 100,
                                align: 'center',
                            },
                            { title: '팀', dataIndex: '팀', key: 'team', fixed: 'left', width: 70, align: 'center' },
                            { title: '재적', dataIndex: '재적', key: '재적', width: 70, align: 'center' },
                            ...STEPS2.map((step) => ({
                                title: step,
                                dataIndex: `${step}_보유`,
                                key: `${step}_보유`,
                                width: 60,
                                align: 'center' as const,
                            })),
                            {
                                title: '개강 목표',
                                dataIndex: '예정_goal',
                                key: '예정_goal',
                                width: 90,
                                align: 'center',
                            },
                            {
                                title: '지난달결과',
                                dataIndex: 'last_month_result',
                                key: 'last_month_result',
                                width: 100,
                                align: 'center',
                            },
                            {
                                title: '복음방 점수',
                                dataIndex: 'gospel_score',
                                key: 'gospel_score',
                                width: 110,
                                align: 'center',
                            },
                            {
                                title: '목표 달성률',
                                dataIndex: 'gospel_rate',
                                key: 'gospel_rate',
                                width: 120,
                                align: 'center',
                                render: (rate: number) => `${rate}%`, // % 기호 추가
                            },
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
