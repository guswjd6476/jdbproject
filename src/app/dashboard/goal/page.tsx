'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { Table, Spin, Radio } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import { Results, TeamResult, REGIONS, Region, STEPS2, get_DEFAULT_예정_goals } from '@/app/lib/types';
import { Students, useStudentsQuery } from '@/app/hook/useStudentsQuery';
import { useUser } from '@/app/hook/useUser';
import { getWeekDateRange, parseDateSafe } from '@/app/lib/function';

dayjs.extend(isBetween);

/* =====================================================
 * 📌 TYPES & CONSTANTS
 * ===================================================== */
const steps = ['발', '찾', '합', '섭', '복', '예정'] as const;
type Step = (typeof steps)[number];

const GOAL_MULTIPLIERS: Record<Step, number> = { 발: 30, 찾: 10, 합: 4, 섭: 2, 복: 1.5, 예정: 1 };
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

type AchievementScore = { all: number; target: number };
type WeeklyAchievement = Record<Step, AchievementScore>;
type TeamAchievement = Record<string, WeeklyAchievement>;
type RegionAchievement = Record<string, TeamAchievement>;
type Achievements = Record<string, RegionAchievement>;

type SummaryData = Record<Step, { goal: number; done: number; rate: number }>;

/* =====================================================
 * 🛠️ UTILS & HELPERS
 * ===================================================== */
const getUnit = (step: Step) => (['발', '찾', '합'].includes(step) ? 1 : 0.5);
const roundToUnit = (value: number, unit: number) => Math.round(value / unit) * unit;
const getWeekCount = (year: number, month: number) => (year < 2025 || (year === 2025 && month <= 8) ? 5 : 8);

const initSteps = <T,>(initVal: () => T): Record<Step, T> =>
    steps.reduce((acc, step) => ({ ...acc, [step]: initVal() }), {} as Record<Step, T>);

const buildMonthlyGoalsFrom예정 = (예정Goal: number): Record<Step, number> => {
    const goals = initSteps(() => 0);
    steps.forEach((s) => {
        let val = roundToUnit(예정Goal * GOAL_MULTIPLIERS[s], getUnit(s));
        goals[s] = Object.is(val, -0) ? 0 : val;
    });
    return goals;
};

/* =====================================================
 * 📊 CORE LOGIC
 * ===================================================== */
const distributeWeeklyGoals = (monthlyGoals: Record<Step, number>, weekCount: number) => {
    const weights = Array.from({ length: weekCount }).map((_, idx) => WEEK_WEIGHTS[idx] ?? {});
    const result = Array.from({ length: weekCount }).map(() => initSteps(() => 0));

    steps.forEach((step) => {
        const totalGoal = monthlyGoals[step] ?? 0;
        if (!totalGoal) return;

        const unit = getUnit(step);
        const totalUnits = Math.round(totalGoal / unit);

        let wArr = weights.map((w) => w[step] ?? 0);
        let wSum = wArr.reduce((a, b) => a + b, 0);

        if (wSum === 0) {
            wArr = Array(weekCount).fill(1);
            wSum = weekCount;
        }

        const quotas = wArr.map((w) => (totalUnits * w) / wSum);
        const unitsPerWeek = quotas.map((q) => Math.floor(q));

        let remain = totalUnits - unitsPerWeek.reduce((a, b) => a + b, 0);
        const remainders = quotas.map((q, i) => ({ i, r: q - Math.floor(q) })).sort((a, b) => b.r - a.r);

        let idx = 0;
        while (remain > 0) {
            unitsPerWeek[remainders[idx % weekCount].i] += 1;
            remain -= 1;
            idx += 1;
        }

        unitsPerWeek.forEach((val, i) => {
            result[i][step] = val * unit;
        });
    });

    return result;
};

const extractTeamFromRaw = (raw?: string) => {
    const t = (raw ?? '').trim();
    if (!t) return '';
    if (t.includes('-')) return t.split('-')[0].trim();
    const m = t.match(/(\d+)/);
    return m ? m[1] : t;
};

const normalizeTeamForAchievements = (region: string, rawTeam: string) => {
    const team = extractTeamFromRaw(rawTeam);
    if (team === '사랑') return region === '중랑' ? '사랑' : '';
    return team;
};

/* =====================================================
 * 📈 DATA AGGREGATION
 * ===================================================== */
const getCumulativeAchievement = (achievements: Achievements, region: string, teamKey: string, weekIndex: number) => {
    const sum = initSteps(() => ({ all: 0, target: 0 }));

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

const calculateMonthlySummary = (results: Results, achievements: Achievements, region: string): SummaryData => {
    const summary = initSteps(() => ({ goal: 0, done: 0, rate: 0 }));

    results.teams.forEach((team) => {
        steps.forEach((s) => {
            summary[s].goal += team.goals[s];
        });

        const teamWeeks = achievements?.[region]?.[team.team];
        if (!teamWeeks) return;

        Object.values(teamWeeks).forEach((wk) => {
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

// ✅ 지연 기능 추가: 파라미터로 weekOffset을 받습니다.
const calculateWeeklyAchievements = (
    students: Students[],
    month: number,
    year: number,
    weekOffset: number
): Achievements => {
    const weekly: Achievements = {};
    const weekCount = getWeekCount(year, month);

    students.forEach((s) => {
        const leaderRegion = (s.인도자지역 ?? '').trim();
        const teacherRegion = (s.교사지역 ?? '').trim();

        if (!REGIONS.includes(leaderRegion as Region)) return;

        const leaderTeam = normalizeTeamForAchievements(leaderRegion, s.인도자팀 ?? '');
        const teacherTeam = normalizeTeamForAchievements(teacherRegion, s.교사팀 ?? '');

        STEPS2.forEach((step) => {
            const dateStr = (s as any)[step];
            if (!dateStr) return;

            const date = parseDateSafe(dateStr);
            if (!date) return;

            const isTargetMonth = (s as any).target === `${month}월`;
            const isHalfScore = ['섭', '복', '예정'].includes(step);

            const targets = isHalfScore
                ? [
                      { region: leaderRegion, team: leaderTeam, score: 0.5 },
                      { region: teacherRegion, team: teacherTeam, score: 0.5 },
                  ]
                : [{ region: leaderRegion, team: leaderTeam, score: 1 }];

            targets.forEach(({ region, team, score }) => {
                if (!REGIONS.includes(region as Region) || !team) return;

                for (let i = 0; i < weekCount; i++) {
                    // ✅ 핵심: 날짜 계산 시 i 에 weekOffset을 더해줍니다!
                    const { start, end } = getWeekDateRange(year, month, i + weekOffset);
                    if (!date.isBetween(start, end, 'day', '[]')) continue;

                    const weekKey = `week${i + 1}`; // 주차 표시는 그대로 week1, week2 유지
                    weekly[region] ??= {};
                    weekly[region][team] ??= {};
                    weekly[region][team][weekKey] ??= initSteps(() => ({ all: 0, target: 0 }));

                    if (!steps.includes(step as Step)) return;

                    weekly[region][team][weekKey][step as Step].all += score;
                    if (['발', '찾'].includes(step) || isTargetMonth) {
                        weekly[region][team][weekKey][step as Step].target += score;
                    }
                }
            });
        });
    });

    return weekly;
};

const initializeResults = (region: Region, year: number, month: number): Results => {
    const regionFGoals = get_DEFAULT_예정_goals(month)[region];
    const emptyResult = { teams: [], totals: initSteps(() => 0) };
    if (!regionFGoals) return emptyResult;

    const weekCount = getWeekCount(year, month);
    const createTeamResult = (teamName: string, goalStr: number | string | undefined): TeamResult | null => {
        const 예정Goal = Number(goalStr ?? 0);
        if (예정Goal <= 0) return null;
        const monthlyGoals = buildMonthlyGoalsFrom예정(예정Goal);
        return { team: teamName, goals: monthlyGoals, weeks: distributeWeeklyGoals(monthlyGoals, weekCount) };
    };

    const baseTeams = Object.entries(regionFGoals)
        .map(([teamId, goal]) => createTeamResult(teamId.replace('team', ''), goal))
        .filter((t): t is TeamResult => t !== null);

    const fGoalsRecord = regionFGoals as Record<string, string>;

    if (region === '중랑' && Number(fGoalsRecord['team4'] ?? 0) > 0) {
        const loveTeam = createTeamResult('사랑', fGoalsRecord['team4']);
        if (loveTeam) baseTeams.push(loveTeam);
    }

    const totals = baseTeams.reduce(
        (acc, t) => {
            steps.forEach((s) => {
                acc[s] += t.goals[s];
            });
            return acc;
        },
        initSteps(() => 0)
    );

    return { teams: baseTeams, totals };
};

/* =====================================================
 * 🎨 COMPONENTS
 * ===================================================== */
const getRateStyle = (rate: number): React.CSSProperties => {
    if (rate >= 100) return { backgroundColor: '#d9f7be', fontWeight: 'bold' };
    if (rate >= 70) return { backgroundColor: '#fff566' };
    return { backgroundColor: '#ffa39e' };
};

const generateWeekRows = (data: { region: string; results: Results }[], achievements: Achievements, wIdx: number) => {
    const weekKey = `week${wIdx + 1}`;
    const needsFormat = ['합', '섭', '복', '예정'];

    return data.flatMap(({ region, results }) =>
        results.teams.map((team) => {
            const weeklyAchRaw =
                achievements?.[region]?.[team.team]?.[weekKey] ?? initSteps(() => ({ all: 0, target: 0 }));
            const cumulative = getCumulativeAchievement(achievements, region, team.team, wIdx);

            const row: Record<string, any> = {
                key: `${region}-${team.team}`,
                team: `${region} ${team.team}팀`,
            };

            steps.forEach((s) => {
                const weeklyGoal = team.weeks[wIdx]?.[s] ?? 0;
                const wk = weeklyAchRaw[s];
                const totalGoal = team.goals[s];
                const cum = cumulative[s];

                const weeklyRate = weeklyGoal > 0 ? (wk.target / weeklyGoal) * 100 : 0;
                const cumRate = totalGoal > 0 ? (cum.target / totalGoal) * 100 : 0;

                row[`${s}-weekly`] = needsFormat.includes(s)
                    ? `${wk.target} (${wk.all}) | ${weeklyGoal}`
                    : `${wk.all} | ${weeklyGoal}`;
                row[`${s}-weeklyRate`] = {
                    text: weeklyGoal ? `${weeklyRate.toFixed(1)}%` : '-',
                    style: getRateStyle(weeklyRate),
                };

                row[`${s}-cum`] = needsFormat.includes(s)
                    ? `${cum.target} (${cum.all}) | ${totalGoal}`
                    : `${cum.all} | ${totalGoal}`;
                row[`${s}-cumRate`] = { text: `${cumRate.toFixed(1)}%`, style: getRateStyle(cumRate) };
            });

            return row;
        })
    );
};

const WeeklyGoalsTable: React.FC<{
    data: { region: string; results: Results }[];
    achievements: Achievements;
    selectedYear: number;
    selectedMonth: number;
    weekOffset: number; // ✅ 지연 기능 추가: Props로 받습니다.
}> = ({ data, achievements, selectedYear, selectedMonth, weekOffset }) => {
    const weekCount = getWeekCount(selectedYear, selectedMonth);

    const columns: ColumnsType<any> = [
        { title: '팀', dataIndex: 'team', align: 'center' as const, fixed: 'left', width: 140 },
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
        <>
            {Array.from({ length: weekCount }).map((_, wIdx) => {
                // ✅ 핵심: 테이블 헤더에 표시할 날짜 범위 텍스트에도 offset 반영
                const { display } = getWeekDateRange(selectedYear, selectedMonth, wIdx + weekOffset);
                const dataSource = generateWeekRows(data, achievements, wIdx);

                return (
                    <div
                        key={wIdx}
                        className="mb-10"
                    >
                        <h3 className="font-semibold mb-2">
                            {selectedYear}년 {selectedMonth}월 {wIdx + 1}주차 ({display})
                        </h3>
                        <Table
                            columns={columns}
                            dataSource={dataSource}
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
 * 🚀 MAIN EXPORT
 * ===================================================== */
export default function GoalPage() {
    const { region: userRegion, isLoading: userLoading } = useUser();
    const { data: students = [], isLoading: studentsLoading } = useStudentsQuery();

    const now = dayjs();
    const [selectedYear, setSelectedYear] = useState(now.year());
    const [selectedMonth, setSelectedMonth] = useState(now.month() + 1);
    const [viewMode, setViewMode] = useState<'region' | 'month'>('region');
    const [region, setRegion] = useState<Region>('도봉');

    // ✅ 시작 지연 상태 추가 (0: 정상시작, 1: 1주 밀림, 2: 2주 밀림)
    const [weekOffset, setWeekOffset] = useState<number>(0);

    const weeklyAchievements = useMemo(
        () => calculateWeeklyAchievements(students, selectedMonth, selectedYear, weekOffset), // ✅ offset 전달
        [students, selectedMonth, selectedYear, weekOffset]
    );

    useEffect(() => {
        if (userRegion && userRegion !== 'all') setRegion(userRegion as Region);
    }, [userRegion]);

    const results = useMemo(
        () => initializeResults(region, selectedYear, selectedMonth),
        [region, selectedMonth, selectedYear]
    );

    const allRegionsResults = useMemo(() => {
        if (viewMode !== 'month') return [];
        return REGIONS.map((r) => ({
            region: r as Region,
            results: initializeResults(r as Region, selectedYear, selectedMonth),
        }));
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

            <div className="flex flex-wrap justify-center gap-3 mb-6">
                <select
                    className="border rounded p-1"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(+e.target.value)}
                >
                    {[selectedYear - 1, selectedYear, selectedYear + 1].map((y) => (
                        <option key={y}>{y}</option>
                    ))}
                </select>

                <select
                    className="border rounded p-1"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(+e.target.value)}
                >
                    {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1}>{i + 1}</option>
                    ))}
                </select>

                {/* ✅ 시작 주차 지연 선택기 추가 */}
                <select
                    className="border rounded p-1 bg-gray-50"
                    value={weekOffset}
                    onChange={(e) => setWeekOffset(+e.target.value)}
                >
                    <option value={0}>정상 시작</option>
                    <option value={1}>1주 지연</option>
                    <option value={2}>2주 지연</option>
                </select>

                {viewMode === 'region' && userRegion === 'all' && (
                    <select
                        className="border rounded p-1"
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

            {monthlySummary && (
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-8">
                    {steps.map((s) => (
                        <div
                            key={s}
                            className="border rounded p-3 text-center bg-white shadow-sm"
                        >
                            <div className="text-sm text-gray-500 mb-1">{s}</div>
                            <div className="font-bold text-lg">
                                {monthlySummary[s].done} <span className="text-gray-300 font-normal">|</span>{' '}
                                {monthlySummary[s].goal}
                            </div>
                            <div
                                className={`text-sm mt-1 font-medium ${
                                    monthlySummary[s].rate >= 100 ? 'text-green-600' : 'text-gray-600'
                                }`}
                            >
                                {monthlySummary[s].rate.toFixed(1)}%
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <WeeklyGoalsTable
                data={viewMode === 'region' ? [{ region, results }] : allRegionsResults}
                achievements={weeklyAchievements}
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
                weekOffset={weekOffset} /* ✅ props 전달 */
            />
        </div>
    );
}
