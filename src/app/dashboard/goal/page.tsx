'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { Table, Spin, Radio } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import { Results, TeamResult, REGIONS, Region, STEPS2, DEFAULT_예정_goals } from '@/app/lib/types';
import { Students, useStudentsQuery } from '@/app/hook/useStudentsQuery';
import { useUser } from '@/app/hook/useUser';
import { getWeekDateRange, parseDateSafe } from '@/app/lib/function';

dayjs.extend(isBetween);

/* =====================================================
 * 단계
 * ===================================================== */
const steps = ['발', '찾', '합', '섭', '복', '예정'] as const;
type Step = (typeof steps)[number];

/* =====================================================
 * ✅ 목표 생성: 예정Goal 기반 배수
 * ===================================================== */
const GOAL_MULTIPLIERS: Record<Step, number> = {
    발: 20,
    찾: 10,
    합: 4,
    섭: 2,
    복: 1.5,
    예정: 1,
};

/* =====================================================
 * ✅ 단위 정책 (0.25 절대 없음)
 * - 발/찾/합: 1 단위
 * - 섭/복/예정: 0.5 단위
 * ===================================================== */
const getUnit = (step: Step) => {
    if (step === '발' || step === '찾' || step === '합') return 1;
    return 0.5;
};
const roundToUnit = (value: number, unit: number) => Math.round(value / unit) * unit;

/* =====================================================
 * ✅ 예정Goal 기반 월 목표 생성 (배수 적용 + 단위 보정)
 * ===================================================== */
const buildMonthlyGoalsFrom예정 = (예정Goal: number): Record<Step, number> => {
    const goals: Record<Step, number> = {
        발: 예정Goal * GOAL_MULTIPLIERS.발,
        찾: 예정Goal * GOAL_MULTIPLIERS.찾,
        합: 예정Goal * GOAL_MULTIPLIERS.합,
        섭: 예정Goal * GOAL_MULTIPLIERS.섭,
        복: 예정Goal * GOAL_MULTIPLIERS.복,
        예정: 예정Goal,
    };

    steps.forEach((s) => {
        const unit = getUnit(s);
        goals[s] = roundToUnit(goals[s], unit);
        if (Object.is(goals[s], -0)) goals[s] = 0;
    });

    return goals;
};

/* =====================================================
 * 주차 수
 * ===================================================== */
const getWeekCount = (year: number, month: string) => {
    const m = Number(month);
    if (year < 2025) return 5;
    if (year === 2025 && m <= 8) return 5;
    return 8;
};

/* =====================================================
 * ✅ 주차별 분배 가중치
 * ===================================================== */
const WEEK_WEIGHTS: Record<number, Partial<Record<Step, number>>> = {
    0: { 발: 1 },
    1: { 발: 1, 찾: 1 },
    2: { 찾: 1, 합: 1 },
    3: { 합: 1 },
    4: { 섭: 1 },
    5: { 섭: 1, 복: 1 },
    6: { 복: 1 },
    7: {},
};

/* =====================================================
 * ✅ 월 목표 -> 주간 목표 자동 분배 (칩 분배 방식)
 * ===================================================== */
const distributeWeeklyGoals = (monthlyGoals: Record<Step, number>, weekCount: number) => {
    const weights = Array.from({ length: weekCount }).map((_, idx) => WEEK_WEIGHTS[idx] ?? {});

    const result = Array.from({ length: weekCount }).map(() => ({
        발: 0,
        찾: 0,
        합: 0,
        섭: 0,
        복: 0,
        예정: 0,
    }));

    steps.forEach((step) => {
        const totalGoal = monthlyGoals[step] ?? 0;
        if (!totalGoal) return;

        const unit = getUnit(step);
        const totalUnits = Math.round(totalGoal / unit);

        let wArr = weights.map((w) => w[step] ?? 0);
        let wSum = wArr.reduce((a, b) => a + b, 0);

        if (wSum === 0) {
            wArr = Array.from({ length: weekCount }).map(() => 1);
            wSum = weekCount;
        }

        // Hamilton method
        const quotas = wArr.map((w) => (totalUnits * w) / wSum);
        const floors = quotas.map((q) => Math.floor(q));
        const unitsPerWeek = [...floors];

        let assigned = floors.reduce((a, b) => a + b, 0);
        let remain = totalUnits - assigned;

        const remainders = quotas.map((q, i) => ({ i, r: q - floors[i] }));
        remainders.sort((a, b) => b.r - a.r);

        let idx = 0;
        while (remain > 0) {
            unitsPerWeek[remainders[idx % weekCount].i] += 1;
            remain -= 1;
            idx += 1;
        }

        for (let i = 0; i < weekCount; i++) {
            result[i][step] = unitsPerWeek[i] * unit;
        }
    });

    return result;
};

/* =====================================================
 * ✅ 실적 데이터에서 팀명 추출
 * - "3-2" => "3"
 * - "사랑-1" => "사랑"
 * ===================================================== */
const extractTeamFromRaw = (raw: string) => {
    const t = (raw ?? '').trim();
    if (!t) return '';

    if (t.includes('-')) return t.split('-')[0].trim();

    const m = t.match(/(\d+)/);
    if (m) return m[1];

    return t;
};

/* =====================================================
 * ✅ 핵심: 사랑팀은 "중랑만 표시"
 * - 중랑 : 사랑-* => "사랑"
 * - 그외 : 사랑-* => "" (무시)
 * ===================================================== */
const normalizeTeamForAchievements = (region: string, rawTeam: string) => {
    const team = extractTeamFromRaw(rawTeam);

    if (team === '사랑') {
        if (region === '중랑') return '사랑'; // ✅ 중랑만 보여줌
        return ''; // ✅ 나머지 지역 사랑팀 데이터는 무시
    }

    return team;
};

/* =====================================================
 * 누적 달성 계산
 * ===================================================== */
const getCumulativeAchievement = (achievements: any, region: string, teamKey: string, weekIndex: number) => {
    const sum = {
        발: { all: 0, target: 0 },
        찾: { all: 0, target: 0 },
        합: { all: 0, target: 0 },
        섭: { all: 0, target: 0 },
        복: { all: 0, target: 0 },
        예정: { all: 0, target: 0 },
    };

    for (let i = 0; i <= weekIndex; i++) {
        const wk = achievements?.[region]?.[teamKey]?.[`week${i + 1}`];
        if (!wk) continue;

        steps.forEach((s) => {
            sum[s].all += wk[s]?.all ?? 0;
            sum[s].target += wk[s]?.target ?? 0;
        });
    }

    return sum;
};

/* =====================================================
 * 월 요약
 * ===================================================== */
const calculateMonthlySummary = (results: Results, achievements: any, region: string) => {
    const summary: any = {
        발: { goal: 0, done: 0, rate: 0 },
        찾: { goal: 0, done: 0, rate: 0 },
        합: { goal: 0, done: 0, rate: 0 },
        섭: { goal: 0, done: 0, rate: 0 },
        복: { goal: 0, done: 0, rate: 0 },
        예정: { goal: 0, done: 0, rate: 0 },
    };

    results.teams.forEach((team) => {
        steps.forEach((s) => {
            summary[s].goal += team.goals[s];
        });

        const teamWeeks = achievements?.[region]?.[team.team];
        if (!teamWeeks) return;

        Object.values(teamWeeks).forEach((wk: any) => {
            steps.forEach((s) => {
                summary[s].done += wk[s]?.target ?? 0;
            });
        });
    });

    steps.forEach((s) => {
        summary[s].rate = summary[s].goal > 0 ? (summary[s].done / summary[s].goal) * 100 : 0;
    });

    return summary;
};

/* =====================================================
 * 주간 테이블
 * ===================================================== */
const WeeklyGoalsTable: React.FC<{
    data: { region: string; results: Results }[];
    achievements: any;
    selectedYear: number;
    selectedMonth: string;
}> = ({ data, achievements, selectedYear, selectedMonth }) => {
    const weekCount = getWeekCount(selectedYear, selectedMonth);

    const getRateStyle = (rate: number): React.CSSProperties => {
        if (rate >= 100) return { backgroundColor: '#d9f7be', fontWeight: 'bold' };
        if (rate >= 70) return { backgroundColor: '#fff566' };
        return { backgroundColor: '#ffa39e' };
    };

    return (
        <>
            {Array.from({ length: weekCount }).map((_, wIdx) => {
                const weekKey = `week${wIdx + 1}`;
                const { display } = getWeekDateRange(selectedYear, Number(selectedMonth), wIdx);

                const rows = data.flatMap(({ region, results }) =>
                    results.teams.map((team) => {
                        const weeklyAchRaw = achievements?.[region]?.[team.team]?.[weekKey] ?? {};
                        const cumulative = getCumulativeAchievement(achievements, region, team.team, wIdx);

                        const row: any = {
                            key: `${region}-${team.team}`,
                            team: `${region} ${team.team}팀`,
                        };

                        steps.forEach((s) => {
                            const weeklyGoal = team.weeks[wIdx]?.[s] ?? 0;
                            const wk = weeklyAchRaw[s] ?? { all: 0, target: 0 };

                            const totalGoal = team.goals[s];
                            const cum = cumulative[s];

                            const weeklyRate = weeklyGoal > 0 ? (wk.target / weeklyGoal) * 100 : 0;
                            const cumRate = totalGoal > 0 ? (cum.target / totalGoal) * 100 : 0;

                            row[`${s}-weekly`] =
                                s === '합' || s === '섭' || s === '복' || s === '예정'
                                    ? `${wk.target} (${wk.all}) | ${weeklyGoal}`
                                    : `${wk.all} | ${weeklyGoal}`;

                            row[`${s}-weeklyRate`] = {
                                text: weeklyGoal ? `${weeklyRate.toFixed(1)}%` : '-',
                                style: getRateStyle(weeklyRate),
                            };

                            row[`${s}-cum`] =
                                s === '합' || s === '섭' || s === '복' || s === '예정'
                                    ? `${cum.target} (${cum.all}) | ${totalGoal}`
                                    : `${cum.all} | ${totalGoal}`;

                            row[`${s}-cumRate`] = {
                                text: `${cumRate.toFixed(1)}%`,
                                style: getRateStyle(cumRate),
                            };
                        });

                        return row;
                    })
                );

                const columns: ColumnsType<any> = [
                    {
                        title: '팀',
                        dataIndex: 'team',
                        align: 'center' as const,
                        fixed: 'left',
                        width: 140,
                    },
                    ...steps.flatMap((s) => [
                        { title: `${s} 주간`, dataIndex: `${s}-weekly`, align: 'center' as const },
                        {
                            title: `${s} 주간률`,
                            dataIndex: `${s}-weeklyRate`,
                            align: 'center' as const,
                            render: (v: { text: string; style: React.CSSProperties }) => (
                                <div style={{ padding: 4, ...v.style }}>{v.text}</div>
                            ),
                        },
                        { title: `${s} 누적`, dataIndex: `${s}-cum`, align: 'center' as const },
                        {
                            title: `${s} 누적률`,
                            dataIndex: `${s}-cumRate`,
                            align: 'center' as const,
                            render: (v: { text: string; style: React.CSSProperties }) => (
                                <div style={{ padding: 4, fontWeight: 'bold', ...v.style }}>{v.text}</div>
                            ),
                        },
                    ]),
                ];

                return (
                    <div
                        key={weekKey}
                        className="mb-10"
                    >
                        <h3 className="font-semibold mb-2">
                            {selectedYear}년 {selectedMonth}월 {wIdx + 1}주차 ({display})
                        </h3>

                        <Table
                            columns={columns}
                            dataSource={rows}
                            pagination={false}
                            bordered
                            size="small"
                            scroll={{ x: 'max-content' }}
                        />
                    </div>
                );
            })}
        </>
    );
};

/* =====================================================
 * ✅ 목표 초기화
 * - 원래 목표(team1~team4)는 1~4로 표시
 * - 단, "중랑"이면 사랑팀도 결과에 추가(실적 표시 목적)
 * ===================================================== */
const initializeResults = (region: Region, year: number, month: string): Results => {
    const regionFGoals = DEFAULT_예정_goals[region];
    if (!regionFGoals) {
        return { teams: [], totals: { 발: 0, 찾: 0, 합: 0, 섭: 0, 복: 0, 예정: 0 } };
    }

    const weekCount = getWeekCount(year, month);

    // 목표는 team1~team4 => 1~4로 고정
    const baseTeams: TeamResult[] = Object.entries(regionFGoals)
        .map(([teamId, 예정GoalStr]) => {
            const teamNum = teamId.replace('team', ''); // team1 -> "1"
            const 예정Goal = Number(예정GoalStr ?? 0);
            if (예정Goal <= 0) return null;

            const monthlyGoals = buildMonthlyGoalsFrom예정(예정Goal);
            const weeks = distributeWeeklyGoals(monthlyGoals, weekCount);

            return {
                team: teamNum,
                goals: monthlyGoals,
                weeks,
            };
        })
        .filter(Boolean) as TeamResult[];

    // ✅ 중랑만 사랑팀 추가(표시용)
    if (region === '중랑') {
        // 사랑팀 목표는: 기존 regionFGoals에서 team4 값을 사랑팀 예정Goal로 사용
        // (여기 규칙은 니가 지금까지 쓰던 "예정 목표" 데이터 구조 유지하면서 사랑팀만 보여주기 위함)
        const love예정Goal = Number(regionFGoals.team4 ?? 0);

        if (love예정Goal > 0) {
            const monthlyGoals = buildMonthlyGoalsFrom예정(love예정Goal);
            const weeks = distributeWeeklyGoals(monthlyGoals, weekCount);

            baseTeams.push({
                team: '사랑',
                goals: monthlyGoals,
                weeks,
            });
        }
    }

    const totals = baseTeams.reduce(
        (acc, t) => ({
            발: acc.발 + t.goals.발,
            찾: acc.찾 + t.goals.찾,
            합: acc.합 + t.goals.합,
            섭: acc.섭 + t.goals.섭,
            복: acc.복 + t.goals.복,
            예정: acc.예정 + t.goals.예정,
        }),
        { 발: 0, 찾: 0, 합: 0, 섭: 0, 복: 0, 예정: 0 }
    );

    return { teams: baseTeams, totals };
};

/* =====================================================
 * ✅ 주간 달성 집계
 * - 사랑팀 데이터는 중랑만 남김
 * ===================================================== */
const calculateWeeklyAchievements = (students: Students[], month: number, year: number) => {
    const weekly: any = {};
    const weekCount = getWeekCount(year, String(month));

    students.forEach((s) => {
        const leaderRegion = (s.인도자지역 ?? '').trim();
        const teacherRegion = (s.교사지역 ?? '').trim();

        if (!REGIONS.includes(leaderRegion as Region)) return;

        // ✅ 팀명 정규화 (사랑팀은 중랑만)
        const leaderTeam = normalizeTeamForAchievements(leaderRegion, s.인도자팀 ?? '');
        const teacherTeam = normalizeTeamForAchievements(teacherRegion, s.교사팀 ?? '');

        STEPS2.forEach((step) => {
            const dateStr = (s as any)[step];
            if (!dateStr) return;

            const date = parseDateSafe(dateStr);
            if (!date) return;

            const isTargetMonth = (s as any).target === `${month}월`;

            const targets =
                step === '섭' || step === '복' || step === '예정'
                    ? [
                          { region: leaderRegion, team: leaderTeam, score: 0.5 },
                          { region: teacherRegion, team: teacherTeam, score: 0.5 },
                      ]
                    : [{ region: leaderRegion, team: leaderTeam, score: 1 }];

            targets.forEach(({ region, team, score }) => {
                if (!REGIONS.includes(region as Region)) return;
                if (!team) return; // ✅ 사랑팀(중랑아닌 지역)은 여기서 빠짐

                for (let i = 0; i < weekCount; i++) {
                    const { start, end } = getWeekDateRange(year, month, i);
                    if (!date.isBetween(start, end, 'day', '[]')) continue;

                    weekly[region] ??= {};
                    weekly[region][team] ??= {};
                    weekly[region][team][`week${i + 1}`] ??= {
                        발: { all: 0, target: 0 },
                        찾: { all: 0, target: 0 },
                        합: { all: 0, target: 0 },
                        섭: { all: 0, target: 0 },
                        복: { all: 0, target: 0 },
                        예정: { all: 0, target: 0 },
                    };

                    if (!steps.includes(step as Step)) return;

                    weekly[region][team][`week${i + 1}`][step].all += score;

                    // 목표월 기준
                    if (step === '발' || step === '찾' || isTargetMonth) {
                        weekly[region][team][`week${i + 1}`][step].target += score;
                    }
                }
            });
        });
    });

    return weekly;
};

/* =====================================================
 * 메인 페이지
 * ===================================================== */
export default function GoalPage() {
    const { region: userRegion, isLoading: userLoading } = useUser();
    const { data: students = [], isLoading: studentsLoading } = useStudentsQuery();

    const now = dayjs();
    const [selectedYear, setSelectedYear] = useState(now.year());
    const [selectedMonth, setSelectedMonth] = useState(String(now.month() + 1));
    const [viewMode, setViewMode] = useState<'region' | 'month'>('region');

    const [region, setRegion] = useState<Region>('도봉');
    const [results, setResults] = useState<Results | null>(null);
    const [allRegionsResults, setAllRegionsResults] = useState<{ region: Region; results: Results }[]>([]);

    const weeklyAchievements = useMemo(
        () => calculateWeeklyAchievements(students, Number(selectedMonth), selectedYear),
        [students, selectedMonth, selectedYear]
    );

    useEffect(() => {
        if (userRegion && userRegion !== 'all') {
            setRegion(userRegion as Region);
        }
    }, [userRegion]);

    useEffect(() => {
        setResults(initializeResults(region, selectedYear, selectedMonth));
    }, [region, selectedMonth, selectedYear]);

    useEffect(() => {
        if (viewMode !== 'month') return;
        setAllRegionsResults(
            REGIONS.map((r) => ({
                region: r,
                results: initializeResults(r, selectedYear, selectedMonth),
            }))
        );
    }, [viewMode, selectedMonth, selectedYear]);

    const monthlySummary = useMemo(() => {
        if (!results || viewMode !== 'region') return null;
        return calculateMonthlySummary(results, weeklyAchievements, region);
    }, [results, weeklyAchievements, region, viewMode]);

    if (userLoading || studentsLoading || !results) {
        return (
            <div className="flex justify-center items-center h-[80vh]">
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-center mb-6">
                {selectedYear}년 {selectedMonth}월 목표 달성
            </h1>

            {/* 상단 컨트롤 */}
            <div className="flex flex-wrap justify-center gap-3 mb-6">
                <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(+e.target.value)}
                >
                    {[selectedYear - 1, selectedYear, selectedYear + 1].map((y) => (
                        <option key={y}>{y}</option>
                    ))}
                </select>

                <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                >
                    {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1}>{i + 1}</option>
                    ))}
                </select>

                {viewMode === 'region' && userRegion === 'all' && (
                    <select
                        value={region}
                        onChange={(e) => setRegion(e.target.value as Region)}
                    >
                        {REGIONS.map((r) => (
                            <option key={r}>{r}</option>
                        ))}
                    </select>
                )}

                <Radio.Group
                    value={viewMode}
                    onChange={(e) => setViewMode(e.target.value)}
                    optionType="button"
                >
                    <Radio.Button value="region">지역별</Radio.Button>
                    <Radio.Button value="month">월별</Radio.Button>
                </Radio.Group>
            </div>

            {/* 월 요약 */}
            {monthlySummary && (
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-8">
                    {steps.map((s) => (
                        <div
                            key={s}
                            className="border rounded p-3 text-center"
                        >
                            <div className="text-sm text-gray-500">{s}</div>
                            <div className="font-bold">
                                {monthlySummary[s].done} | {monthlySummary[s].goal}
                            </div>
                            <div>{monthlySummary[s].rate.toFixed(1)}%</div>
                        </div>
                    ))}
                </div>
            )}

            <WeeklyGoalsTable
                data={viewMode === 'region' ? [{ region, results }] : allRegionsResults}
                achievements={weeklyAchievements}
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
            />
        </div>
    );
}
