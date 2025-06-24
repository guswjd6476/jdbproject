'use client';
import * as React from 'react';
import {
    ConversionRates,
    FGoals,
    Results,
    TeamResult,
    WeeklyGoals,
    WeeklyPercentages,
    STEPS,
    REGIONS,
    fixedTeams,
    DEFAULT_F_GOALS,
    Region,
} from '@/app/lib/types';
import { useState, useEffect, useMemo, useCallback } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { useStudentsQuery, Student } from '@/app/hook/useStudentsQuery';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isBetween);
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const initializeResults = (
    fGoals: FGoals,
    conversionRates: ConversionRates,
    weeklyPercentages: WeeklyPercentages
): Results => {
    const goals = Object.values(fGoals).map((f) => parseFloat(f));

    const teamResults: TeamResult[] = goals.map((fValue, index) => {
        const d = Math.ceil(fValue / conversionRates.dToF);
        const c = Math.ceil(d / conversionRates.cToD);
        const b = Math.ceil(c / conversionRates.bToC);
        const a = Math.ceil(b / conversionRates.aToB);

        const weeks = ['week1', 'week2', 'week3', 'week4', 'week5'].map((week) => {
            const percentages = weeklyPercentages[week as keyof WeeklyPercentages];
            return {
                A: percentages.A === 0 ? 0 : Math.ceil(a * percentages.A),
                B: percentages.B === 0 ? 0 : Math.ceil(b * percentages.B),
                C: percentages.C === 0 ? 0 : Math.ceil(c * percentages.C),
                D: percentages.D === 0 ? 0 : Math.ceil(d * percentages.D),
                F: percentages.F === 0 ? 0 : Math.ceil(fValue * percentages.F),
            };
        });

        return { team: index + 1, goals: { A: a, B: b, C: c, D: d, F: fValue }, weeks };
    });

    const totals: WeeklyGoals = teamResults.reduce(
        (acc: WeeklyGoals, team: TeamResult) => ({
            A: acc.A + team.goals.A,
            B: acc.B + team.goals.B,
            C: acc.C + team.goals.C,
            D: acc.D + team.goals.D,
            F: acc.F + team.goals.F,
        }),
        { A: 0, B: 0, C: 0, D: 0, F: 0 }
    );

    return { teams: teamResults, totals };
};

const getWeekDateRange = (
    month: number,
    year: number,
    weekIndex: number
): { start: Dayjs; end: Dayjs; display: string } => {
    const firstDay = dayjs(new Date(year, month - 1, 1));
    const firstMonday = firstDay.add((8 - firstDay.day()) % 7 || 7, 'day');

    const startDate = firstMonday.add(weekIndex * 7 - 14, 'day');
    const endDate = startDate.add(6, 'day');

    return {
        start: startDate,
        end: endDate,
        display: `${startDate.format('M.D')}~${endDate.format('M.D')}`,
    };
};

const getTeamName = (team?: string | null): string => {
    if (!team) return '기타팀';
    const prefix = team.split('-')[0];
    return fixedTeams.find((t) => t.startsWith(prefix)) ?? '기타팀';
};

type Step = (typeof STEPS)[number];
interface TableRow {
    key: string;
    지역: string;
    팀: string;
    탈락: number;
    [key: string]: string | number;
}

const calculateAchievements = (
    students: Student[],
    selectedMonth: number,
    year: number,
    mode: 'weekly' | 'monthly'
): {
    weekly: Record<string, Record<string, Record<string, Record<string, number>>>>;
    monthly?: { achievements: TableRow[]; totalRow: TableRow };
} => {
    const weeklyAchievements: Record<string, Record<string, Record<string, Record<string, number>>>> = {};
    const monthlyAchievements: Record<string, Record<string, Record<string, number>>> = {};
    const monthlyTotalRow: TableRow = {
        key: 'total',
        지역: '',
        팀: '',
        탈락: 0,
        ...['A', 'B', 'C', 'D', 'F'].reduce(
            (acc, step) => ({
                ...acc,
                [step]: 0,
                [`${step}_탈락`]: 0,
                [`${step}_보유`]: 0,
            }),
            {}
        ),
    };
    const holdMap: Record<string, number> = {};

    students.forEach((s) => {
        const 지역 = (s.인도자지역 ?? '').trim();
        const 팀 = getTeamName(s.인도자팀);
        if (!REGIONS.includes(지역 as Region) || !fixedTeams.includes(팀)) return;

        if (mode === 'monthly') {
            const currentStep = (s.단계 ?? '').toUpperCase();
            const mappedStep = currentStep === 'D-1' || currentStep === 'D-2' ? 'D' : currentStep;
            if (STEPS.includes(mappedStep as Step)) {
                holdMap[`${지역}-${팀}-${mappedStep}`] = (holdMap[`${지역}-${팀}-${mappedStep}`] ?? 0) + 1;
            }
        }

        ['A', 'B', 'C', 'D-1', 'D-2', 'F'].forEach((step) => {
            const key = step.toLowerCase() as keyof Student;
            const dateStr = s[key] as string | null | undefined;
            if (!dateStr) return;

            const date = dayjs(dateStr);
            if (!date.isValid() || date.year() !== year) return;

            const mappedStep = step === 'D-1' || step === 'D-2' ? 'D' : step;
            const teamNumber = 팀.match(/\d+/)?.[0] || 팀;

            if (mode === 'weekly') {
                ['week1', 'week2', 'week3', 'week4'].forEach((week, index) => {
                    const { start, end } = getWeekDateRange(selectedMonth, year, index);
                    if (!date.isBetween(start, end, 'day', '[]')) return;

                    weeklyAchievements[지역] = weeklyAchievements[지역] ?? {};
                    weeklyAchievements[지역][teamNumber] = weeklyAchievements[지역][teamNumber] ?? {};
                    weeklyAchievements[지역][teamNumber][week] = weeklyAchievements[지역][teamNumber][week] ?? {};
                    weeklyAchievements[지역][teamNumber][week][mappedStep] =
                        (weeklyAchievements[지역][teamNumber][week][mappedStep] ?? 0) + 1;
                });
            } else if (date.month() + 1 === selectedMonth) {
                monthlyAchievements[지역] = monthlyAchievements[지역] ?? {};
                monthlyAchievements[지역][팀] = monthlyAchievements[지역][팀] ?? {};
                monthlyAchievements[지역][팀][mappedStep] = (monthlyAchievements[지역][팀][mappedStep] ?? 0) + 1;
            }
        });
    });

    if (mode === 'monthly') {
        const tableData: TableRow[] = [];
        REGIONS.forEach((region) => {
            const teams = fixedTeams.filter((t) => monthlyAchievements[region]?.[t]);
            teams.forEach((team) => {
                const stepData = monthlyAchievements[region]?.[team] || {};
                const row: TableRow = {
                    key: `${region}-${team}`,
                    지역: region,
                    팀: team,
                    탈락: stepData['탈락'] ?? 0,
                    ...['A', 'B', 'C', 'D', 'F'].reduce(
                        (acc, step) => ({
                            ...acc,
                            [step]: stepData[step] ?? 0,
                            [`${step}_탈락`]: stepData[`${step}_탈락`] ?? 0,
                            [`${step}_보유`]: holdMap[`${region}-${team}-${step}`] ?? 0,
                        }),
                        {}
                    ),
                };
                tableData.push(row);
            });
        });

        tableData.forEach((row) => {
            ['A', 'B', 'C', 'D', 'F'].forEach((step) => {
                monthlyTotalRow[step] = (monthlyTotalRow[step] as number) + (row[step] as number);
                monthlyTotalRow[`${step}_탈락`] =
                    (monthlyTotalRow[`${step}_탈락`] as number) + (row[`${step}_탈락`] as number);
                monthlyTotalRow[`${step}_보유`] =
                    (monthlyTotalRow[`${step}_보유`] as number) + (row[`${step}_보유`] as number);
            });
            monthlyTotalRow.탈락 += row.탈락;
        });

        return { weekly: weeklyAchievements, monthly: { achievements: tableData, totalRow: monthlyTotalRow } };
    }

    return { weekly: weeklyAchievements };
};

const WeeklyGoalsTable = ({
    data,
    achievements,
    selectedMonth,
    year,
    view,
}: {
    data: { region: string; results: Results }[];
    achievements: Record<string, Record<string, Record<string, Record<string, number>>>>;
    selectedMonth: number;
    year: number;
    view: 'region' | 'month';
}) => {
    const weeks = ['week1', 'week2', 'week3', 'week4', 'week5'] as (keyof WeeklyPercentages)[];
    const totalAchievements = useMemo(() => {
        return weeks.reduce((weekAcc: Record<string, WeeklyGoals>, week) => {
            weekAcc[week] = data.reduce(
                (acc: WeeklyGoals, { region, results }) => {
                    const regionTeams = results.teams;
                    const teamSums = regionTeams.reduce(
                        (teamAcc: WeeklyGoals, team: TeamResult) => {
                            const teamAch = achievements[region]?.[`${team.team}`]?.[week] || {};
                            return {
                                A: teamAcc.A + (teamAch.A || 0),
                                B: teamAcc.B + (teamAch.B || 0),
                                C: teamAcc.C + (teamAch.C || 0),
                                D: teamAcc.D + (teamAch.D || 0),
                                F: teamAcc.F + (teamAch.F || 0),
                            };
                        },
                        { A: 0, B: 0, C: 0, D: 0, F: 0 }
                    );
                    return {
                        A: acc.A + teamSums.A,
                        B: acc.B + teamSums.B,
                        C: acc.C + teamSums.C,
                        D: acc.D + teamSums.D,
                        F: acc.F + teamSums.F,
                    };
                },
                { A: 0, B: 0, C: 0, D: 0, F: 0 }
            );
            return weekAcc;
        }, {});
    }, [data, achievements, weeks]);

    return (
        <>
            {weeks.map((week, weekIndex) => {
                const { display } = getWeekDateRange(selectedMonth, year, weekIndex);
                return (
                    <div key={week} className="mb-6">
                        <h3 className="text-md font-medium mb-2">
                            {weekIndex + 1}주차 ({display})
                        </h3>
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border p-2">{view === 'region' ? '지역' : '지역/팀'}</th>
                                    {['A', 'B', 'C', 'D', 'F'].map((step) => (
                                        <th key={step} className="border p-2" colSpan={3}>
                                            {step}
                                        </th>
                                    ))}
                                </tr>
                                <tr className="bg-gray-50">
                                    <th className="border p-2"></th>
                                    {['A', 'B', 'C', 'D', 'F'].map((step) => (
                                        <React.Fragment key={step}>
                                            <th className="border p-2">목표</th>
                                            <th className="border p-2">달성</th>
                                            <th className="border p-2">달성률</th>
                                        </React.Fragment>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.flatMap(({ region, results }) =>
                                    results.teams.map((team: TeamResult) => {
                                        const teamAch = achievements[region]?.[`${team.team}`]?.[week] || {};
                                        return (
                                            <tr key={`${region}-${team.team}`}>
                                                <td className="border p-2">
                                                    {view === 'region'
                                                        ? `${region} ${team.team}팀`
                                                        : `${region} ${team.team}팀`}
                                                </td>
                                                {(['A', 'B', 'C', 'D', 'F'] as (keyof WeeklyGoals)[]).map((step) => (
                                                    <React.Fragment key={step}>
                                                        <td className="border p-2 text-center">
                                                            {team.weeks[weekIndex][step]}
                                                        </td>
                                                        <td className="border p-2 text-center">{teamAch[step] || 0}</td>
                                                        <td className="border p-2 text-center">
                                                            {team.weeks[weekIndex][step] > 0
                                                                ? (
                                                                      ((teamAch[step] || 0) /
                                                                          team.weeks[weekIndex][step]) *
                                                                      100
                                                                  ).toFixed(2) + '%'
                                                                : '0.00%'}
                                                        </td>
                                                    </React.Fragment>
                                                ))}
                                            </tr>
                                        );
                                    })
                                )}
                                <tr className="font-bold">
                                    <td className="border p-2">계</td>
                                    {(['A', 'B', 'C', 'D', 'F'] as (keyof WeeklyGoals)[]).map((step) => {
                                        const totalGoal = data.reduce(
                                            (sum, { results }) =>
                                                sum +
                                                results.teams.reduce(
                                                    (teamSum, team) => teamSum + team.weeks[weekIndex][step],
                                                    0
                                                ),
                                            0
                                        );
                                        return (
                                            <React.Fragment key={step}>
                                                <td className="border p-2 text-center">{totalGoal}</td>
                                                <td className="border p-2 text-center">
                                                    {totalAchievements[week][step]}
                                                </td>
                                                <td className="border p-2 text-center">
                                                    {totalGoal > 0
                                                        ? ((totalAchievements[week][step] / totalGoal) * 100).toFixed(
                                                              2
                                                          ) + '%'
                                                        : '0.00%'}
                                                </td>
                                            </React.Fragment>
                                        );
                                    })}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                );
            })}
        </>
    );
};

const RenderChart = ({
    view,
    data,
    achievements,
    selectedMonth,
    year,
}: {
    view: 'region' | 'month';
    data: { region: string; results: Results }[];
    achievements: Record<string, Record<string, Record<string, Record<string, number>>>>;
    selectedMonth: number;
    year: number;
}) => {
    const weeks = ['week1', 'week2', 'week3', 'week4', 'week5'] as (keyof WeeklyPercentages)[];
    const labels =
        view === 'region'
            ? data[0].results.teams.map((team) => `${data[0].region} ${team.team}팀`)
            : data.flatMap(({ region, results }) => results.teams.map((team) => `${region} ${team.team}팀`));

    return weeks.map((week, weekIndex) => {
        const { display } = getWeekDateRange(selectedMonth, year, weekIndex);
        const chartData = {
            labels,
            datasets: ['A', 'B', 'C', 'D', 'F']
                .map((step, i) => [
                    {
                        label: `${step} 단계 목표`,
                        data: data.flatMap(({ results }) =>
                            results.teams.map((team) => team.weeks[weekIndex][step as keyof WeeklyGoals])
                        ),
                        backgroundColor: `rgba(${54 + i * 50}, ${162 - i * 30}, ${235 - i * 40}, 0.3)`,
                        borderColor: `rgba(${54 + i * 50}, ${162 - i * 30}, ${235 - i * 40}, 0.8)`,
                        borderWidth: 1,
                    },
                    {
                        label: `${step} 단계 달성`,
                        data: data.flatMap(({ region, results }) =>
                            results.teams.map((team) => achievements[region]?.[`${team.team}`]?.[week]?.[step] || 0)
                        ),
                        backgroundColor: `rgba(${54 + i * 50}, ${162 - i * 30}, ${235 - i * 40}, 0.7)`,
                        borderColor: `rgba(${54 + i * 50}, ${162 - i * 30}, ${235 - i * 40}, 1)`,
                        borderWidth: 1,
                    },
                ])
                .flat(),
        };

        const options = {
            scales: {
                y: { beginAtZero: true, title: { display: true, text: '수' } },
                x: { title: { display: true, text: view === 'region' ? '팀' : '지역 및 팀' } },
            },
            plugins: {
                legend: { position: 'top' as const },
                title: {
                    display: true,
                    text: `${selectedMonth}월 ${weekIndex + 1}주차 (${display}) ${
                        view === 'region' ? data[0].region : '전체 지역'
                    } A, B, C, D, F 단계 목표 vs 달성`,
                },
            },
        };

        return (
            <div key={week} className="mb-8">
                <h3 className="text-md font-medium mb-4">
                    {weekIndex + 1}주차 ({display})
                </h3>
                <Bar data={chartData} options={options} />
            </div>
        );
    });
};

export default function GoalCalculatorTable() {
    const { data: students = [], isLoading } = useStudentsQuery();
    const year = 2025;

    const defaultConversionRates = useMemo(
        () => ({
            aToB: 0.5,
            bToC: 0.5,
            cToD: 0.6,
            dToF: 0.6,
        }),
        []
    );

    const defaultWeeklyPercentages = useMemo(
        () => ({
            week1: { A: 0.5, B: 0.2, C: 0.0, D: 0.0, F: 0.0 },
            week2: { A: 0.4, B: 0.3, C: 0.1, D: 0.0, F: 0.0 },
            week3: { A: 0.1, B: 0.4, C: 0.8, D: 0.1, F: 0.0 },
            week4: { A: 0.0, B: 0.1, C: 0.1, D: 0.8, F: 0.1 },
            week5: { A: 0.0, B: 0.0, C: 0.0, D: 0.1, F: 0.9 },
        }),
        []
    );

    const [view, setView] = useState<'region' | 'month'>('region');
    const [displayMode, setDisplayMode] = useState<'table' | 'graph'>('table');
    const [region, setRegion] = useState<Region>('도봉');
    const [fGoals, setFGoals] = useState<FGoals>(DEFAULT_F_GOALS['도봉']);
    const [conversionRates, setConversionRates] = useState<ConversionRates>(defaultConversionRates);
    const [weeklyPercentages, setWeeklyPercentages] = useState<WeeklyPercentages>(defaultWeeklyPercentages);
    const [results, setResults] = useState<Results>(
        initializeResults(DEFAULT_F_GOALS['도봉'], defaultConversionRates, defaultWeeklyPercentages)
    );
    const [error, setError] = useState<string>('');
    const [apiError, setApiError] = useState<string>('');
    const [successMessage, setSuccessMessage] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>('6');
    const [allRegionsResults, setAllRegionsResults] = useState<{ region: Region; results: Results }[]>([]);

    const { weekly: weeklyAchievements, monthly } = useMemo(
        () => calculateAchievements(students, parseInt(selectedMonth), year, view === 'month' ? 'monthly' : 'weekly'),
        [students, selectedMonth, view]
    );

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const response = await fetch(`/api/goal?region=${region}&month=${selectedMonth}&year=${year}`);
                const result = await response.json();
                if (result.data) {
                    setFGoals(result.data.f_goals);
                    setConversionRates(result.data.conversion_rates);
                    setWeeklyPercentages(result.data.weekly_percentages);
                    calculateGoals(result.data.f_goals, result.data.conversion_rates, result.data.weekly_percentages);
                } else {
                    setFGoals(DEFAULT_F_GOALS[region]);
                    setConversionRates(defaultConversionRates);
                    setWeeklyPercentages(defaultWeeklyPercentages);
                    calculateGoals(DEFAULT_F_GOALS[region], defaultConversionRates, defaultWeeklyPercentages);
                }
                setApiError('');
            } catch (err) {
                setApiError('서버에서 설정을 가져오지 못했습니다.');
                console.error('Fetch config error:', err);
                setFGoals(DEFAULT_F_GOALS[region]);
                calculateGoals(DEFAULT_F_GOALS[region], defaultConversionRates, defaultWeeklyPercentages);
            }
        };
        fetchConfig();
    }, [region, selectedMonth, defaultConversionRates, defaultWeeklyPercentages]);

    useEffect(() => {
        const fetchAllRegionsResults = async () => {
            const resultsByRegion: { region: Region; results: Results }[] = [];
            for (const reg of REGIONS) {
                try {
                    const response = await fetch(`/api/goal?region=${reg}&month=${selectedMonth}&year=${year}`);
                    const result = await response.json();
                    const results = initializeResults(
                        result.data?.f_goals || DEFAULT_F_GOALS[reg],
                        result.data?.conversion_rates || defaultConversionRates,
                        result.data?.weekly_percentages || defaultWeeklyPercentages
                    );
                    resultsByRegion.push({ region: reg, results });
                } catch (err) {
                    console.error(`Fetch config error for ${reg}:`, err);
                    const results = initializeResults(
                        DEFAULT_F_GOALS[reg],
                        defaultConversionRates,
                        defaultWeeklyPercentages
                    );
                    resultsByRegion.push({ region: reg, results });
                }
            }
            setAllRegionsResults(resultsByRegion);
        };
        fetchAllRegionsResults();
    }, [selectedMonth, defaultConversionRates, defaultWeeklyPercentages]);

    const calculateGoals = useCallback(
        (
            currentFGoals: FGoals,
            currentConversionRates: ConversionRates,
            currentWeeklyPercentages: WeeklyPercentages
        ) => {
            const goals = Object.values(currentFGoals).map(parseFloat);
            if (goals.some((f) => isNaN(f) || f < 0)) {
                setError('모든 팀의 F 목표는 유효한 양수이어야 합니다.');
                return;
            }
            if (Object.values(currentConversionRates).some((rate) => isNaN(rate) || rate <= 0 || rate > 1)) {
                setError('모든 단계향상률은 1~100% 사이의 정수 백분율이어야 합니다.');
                return;
            }
            const invalidWeek = Object.keys(currentWeeklyPercentages).find((week) =>
                Object.values(currentWeeklyPercentages[week as keyof WeeklyPercentages]).some((p) => isNaN(p) || p < 0)
            );
            if (invalidWeek) {
                setError('모든 주차의 비율은 0~100% 사이의 정수 백분율이어야 합니다.');
                return;
            }

            const newResults = initializeResults(currentFGoals, currentConversionRates, currentWeeklyPercentages);
            setResults((prev) => {
                if (JSON.stringify(prev) === JSON.stringify(newResults)) return prev;
                return {
                    teams: newResults.teams.map((team) => ({
                        ...team,
                        goals: { ...team.goals },
                        weeks: team.weeks.map((week) => ({ ...week })),
                    })),
                    totals: { ...newResults.totals },
                };
            });
            setError('');
        },
        []
    );

    const saveConfig = useCallback(async () => {
        const goals = Object.values(fGoals).map(parseFloat);
        if (goals.some((f) => isNaN(f) || f < 0)) {
            setApiError('F 목표는 유효한 양수이어야 합니다.');
            return;
        }

        try {
            const response = await fetch('/api/goal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    region,
                    month: parseInt(selectedMonth),
                    year,
                    fGoals,
                    conversionRates,
                    weeklyPercentages,
                }),
            });
            const result = await response.json();
            if (!result.success) {
                setApiError(result.error || '설정을 저장하지 못했습니다.');
                setSuccessMessage('');
            } else {
                setApiError('');
                setSuccessMessage('설정이 성공적으로 저장되었습니다.');
                setTimeout(() => setSuccessMessage(''), 3000);
            }
        } catch (err) {
            setApiError('서버에 설정을 저장하지 못했습니다.');
            setSuccessMessage('');
            console.error('Save config error:', err);
        }
    }, [region, selectedMonth, fGoals, conversionRates, weeklyPercentages]);

    const handleInputChange = useCallback(
        (
            type: 'fGoal' | 'conversionRate' | 'weeklyPercentage',
            key: string,
            value: string,
            week?: keyof WeeklyPercentages
        ) => {
            if (type === 'fGoal') {
                const regex = /^\d*\.?\d?$/;
                if (!regex.test(value) && value !== '') {
                    setError('F 목표는 양수이며 소수점 한 자리까지만 입력 가능합니다.');
                    return;
                }
                const numValue = parseFloat(value);
                if (value !== '' && (isNaN(numValue) || numValue < 0)) {
                    setError('F 목표는 유효한 양수이어야 합니다.');
                    return;
                }
                setFGoals((prev) => {
                    const newFGoals = { ...prev, [key]: value };
                    calculateGoals(newFGoals, conversionRates, weeklyPercentages);
                    return newFGoals;
                });
            } else if (type === 'conversionRate') {
                const numValue = parseInt(value) / 100;
                if (isNaN(numValue) || numValue <= 0 || numValue > 1 || !Number.isInteger(parseFloat(value))) {
                    setError('단계향상률은 1~100% 사이의 정수 백분율이어야 합니다.');
                    return;
                }
                setConversionRates((prev) => {
                    const newConversionRates = { ...prev, [key]: numValue };
                    calculateGoals(fGoals, newConversionRates, weeklyPercentages);
                    return newConversionRates;
                });
            } else if (type === 'weeklyPercentage' && week) {
                const num = Number(value);
                if (isNaN(num) || num < 0 || num > 100 || !Number.isInteger(num)) {
                    setError('비율은 0~100% 사이의 정수 백분율이어야 합니다.');
                    return;
                }
                setWeeklyPercentages((prev) => {
                    const currentWeek = { ...prev[week] };
                    const newValue = num / 100;
                    currentWeek[key as keyof WeeklyGoals] = newValue;
                    if (newValue === 1) {
                        (['A', 'B', 'C', 'D', 'F'] as (keyof WeeklyGoals)[]).forEach((k) => {
                            if (k !== key) currentWeek[k] = 0;
                        });
                    }
                    const newWeeklyPercentages = { ...prev, [week]: currentWeek };
                    calculateGoals(fGoals, conversionRates, newWeeklyPercentages);
                    return newWeeklyPercentages;
                });
            }
            setError('');
        },
        [fGoals, conversionRates, weeklyPercentages, calculateGoals]
    );

    const handleRegionChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            const newRegion = e.target.value as Region;
            setRegion(newRegion);
            setFGoals(DEFAULT_F_GOALS[newRegion]);
            calculateGoals(DEFAULT_F_GOALS[newRegion], conversionRates, weeklyPercentages);
        },
        [conversionRates, weeklyPercentages, calculateGoals]
    );

    const handleMonthChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedMonth(e.target.value),
        []
    );

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">데이터를 불러오는 중입니다...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full mx-auto p-6">
            <div className="flex justify-center mb-4">
                <button
                    onClick={() => setView('region')}
                    className={`px-4 py-2 mr-2 rounded-md ${
                        view === 'region' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                >
                    지역별 보기
                </button>
                <button
                    onClick={() => setView('month')}
                    className={`px-4 py-2 rounded-md ${
                        view === 'month' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                >
                    월별 보기
                </button>
            </div>

            <div className="flex justify-center mb-4">
                <button
                    onClick={() => setDisplayMode('table')}
                    className={`px-4 py-2 mr-2 rounded-md ${
                        displayMode === 'table' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                >
                    표로 보기
                </button>
                <button
                    onClick={() => setDisplayMode('graph')}
                    className={`px-4 py-2 rounded-md ${
                        displayMode === 'graph' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                >
                    그래프로 보기
                </button>
            </div>

            {apiError && <p className="mt-2 text-sm text-red-600 text-center">{apiError}</p>}
            {successMessage && <p className="mt-2 text-sm text-green-600 text-center">{successMessage}</p>}

            {view === 'region' ? (
                <>
                    <h1 className="text-2xl font-bold mb-4 text-center">
                        청년회 {selectedMonth}월 {region} 그룹 복음방 개강 4주 플랜 목표 설정
                    </h1>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label htmlFor="region-select" className="block text-sm font-medium text-gray-700">
                                지역 선택:
                            </label>
                            <select
                                id="region-select"
                                value={region}
                                onChange={handleRegionChange}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            >
                                {REGIONS.map((reg) => (
                                    <option key={reg} value={reg}>
                                        {reg}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="month-select" className="block text-sm font-medium text-gray-700">
                                월 선택:
                            </label>
                            <select
                                id="month-select"
                                value={selectedMonth}
                                onChange={handleMonthChange}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                    <option key={month} value={month}>
                                        {month}월
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        {Object.keys(fGoals).map((team, index) => (
                            <div key={team}>
                                <label htmlFor={team} className="block text-sm font-medium text-gray-700">
                                    {region} {index + 1}팀 F 목표:
                                </label>
                                <input
                                    type="number"
                                    id={team}
                                    value={fGoals[team]}
                                    onChange={(e) => handleInputChange('fGoal', team, e.target.value)}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    placeholder={`e.g., ${Object.values(DEFAULT_F_GOALS[region])[index]}`}
                                    step="0.1"
                                />
                            </div>
                        ))}
                    </div>

                    {error && <p className="mt-2 text-sm text-red-600 text-center">{error}</p>}

                    <div className="mt-6">
                        {displayMode === 'table' ? (
                            <>
                                <h2 className="text-lg font-semibold mb-2">개강대비 목표 종합</h2>
                                <table className="w-full border-collapse mb-6">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="border p-2">지역</th>
                                            <th className="border p-2">A</th>
                                            <th className="border p-2">B</th>
                                            <th className="border p-2">C</th>
                                            <th className="border p-2">D</th>
                                            <th className="border p-2">F</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.teams.map((team: TeamResult) => (
                                            <tr key={team.team}>
                                                <td className="border p-2">
                                                    {region} {team.team}팀
                                                </td>
                                                <td className="border p-2 text-center">{team.goals.A}</td>
                                                <td className="border p-2 text-center">{team.goals.B}</td>
                                                <td className="border p-2 text-center">{team.goals.C}</td>
                                                <td className="border p-2 text-center">{team.goals.D}</td>
                                                <td className="border p-2 text-center">{team.goals.F}</td>
                                            </tr>
                                        ))}
                                        <tr className="font-bold">
                                            <td className="border p-2">계</td>
                                            <td className="border p-2 text-center">{results.totals.A}</td>
                                            <td className="border p-2 text-center">{results.totals.B}</td>
                                            <td className="border p-2 text-center">{results.totals.C}</td>
                                            <td className="border p-2 text-center">{results.totals.D}</td>
                                            <td className="border p-2 text-center">{results.totals.F}</td>
                                        </tr>
                                    </tbody>
                                </table>

                                <h2 className="text-lg font-semibold mb-2">단계향상률</h2>
                                <table className="w-full border-collapse mb-6">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="border p-2">A→B</th>
                                            <th className="border p-2">B→C</th>
                                            <th className="border p-2">C→D</th>
                                            <th className="border p-2">D→F</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            {(['aToB', 'bToC', 'cToD', 'dToF'] as (keyof ConversionRates)[]).map(
                                                (key) => (
                                                    <td key={key} className="border p-2 text-center">
                                                        <input
                                                            type="number"
                                                            value={(conversionRates[key] * 100).toFixed(0)}
                                                            onChange={(e) =>
                                                                handleInputChange('conversionRate', key, e.target.value)
                                                            }
                                                            className="w-16 px-2 py-1 border rounded-md text-center"
                                                            step="1"
                                                            min="1"
                                                            max="100"
                                                        />
                                                        %
                                                    </td>
                                                )
                                            )}
                                        </tr>
                                    </tbody>
                                </table>

                                <h2 className="text-lg font-semibold mb-2">주차별 비율 설정</h2>
                                <table className="w-full border-collapse mb-6">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="border p-2">주차</th>
                                            <th className="border p-2">A</th>
                                            <th className="border p-2">B</th>
                                            <th className="border p-2">C</th>
                                            <th className="border p-2">D</th>
                                            <th className="border p-2">F</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.keys(weeklyPercentages).map((week, index) => (
                                            <tr key={week}>
                                                <td className="border p-2">{index + 1}주차</td>
                                                {(['A', 'B', 'C', 'D', 'F'] as (keyof WeeklyGoals)[]).map((key) => (
                                                    <td key={key} className="border p-2 text-center">
                                                        <input
                                                            type="number"
                                                            value={(
                                                                weeklyPercentages[week as keyof WeeklyPercentages][
                                                                    key
                                                                ] * 100
                                                            ).toFixed(0)}
                                                            onChange={(e) =>
                                                                handleInputChange(
                                                                    'weeklyPercentage',
                                                                    key,
                                                                    e.target.value,
                                                                    week as keyof WeeklyPercentages
                                                                )
                                                            }
                                                            className="w-16 px-2 py-1 border rounded-md text-center"
                                                            step="1"
                                                            min="0"
                                                            max="100"
                                                        />
                                                        %
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                        <tr className="font-bold">
                                            <td className="border p-2">총합</td>
                                            {(['A', 'B', 'C', 'D', 'F'] as (keyof WeeklyGoals)[]).map((key) => (
                                                <td key={key} className="border p-2 text-center">
                                                    {(
                                                        Object.values(weeklyPercentages).reduce(
                                                            (sum: number, week: WeeklyGoals) => sum + week[key],
                                                            0
                                                        ) * 100
                                                    ).toFixed(0)}
                                                    %
                                                </td>
                                            ))}
                                        </tr>
                                    </tbody>
                                </table>
                                <div className="flex justify-center mb-4">
                                    <button
                                        onClick={saveConfig}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        저장
                                    </button>
                                </div>
                                <h2 className="text-lg font-semibold mb-2">
                                    {selectedMonth}월 {region} 개강 목표
                                </h2>
                                <WeeklyGoalsTable
                                    data={[{ region, results }]}
                                    achievements={weeklyAchievements}
                                    selectedMonth={parseInt(selectedMonth)}
                                    year={year}
                                    view="region"
                                />
                            </>
                        ) : (
                            <div className="mt-6">
                                <RenderChart
                                    view="region"
                                    data={[{ region, results }]}
                                    achievements={weeklyAchievements}
                                    selectedMonth={parseInt(selectedMonth)}
                                    year={year}
                                />
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <>
                    <h1 className="text-2xl font-bold mb-4 text-center">
                        청년회 {selectedMonth}월 전체 지역 그룹 복음방 개강 4주 플랜 목표 설정
                    </h1>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label htmlFor="month-select" className="block text-sm font-medium text-gray-700">
                                월 선택:
                            </label>
                            <select
                                id="month-select"
                                value={selectedMonth}
                                onChange={handleMonthChange}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                    <option key={month} value={month}>
                                        {month}월
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {error && <p className="mt-2 text-sm text-red-600 text-center">{error}</p>}

                    <div className="mt-6">
                        {displayMode === 'table' ? (
                            <>
                                <h2 className="text-lg font-semibold mb-2">{selectedMonth}월 전체 지역 개강 목표</h2>
                                <WeeklyGoalsTable
                                    data={allRegionsResults}
                                    achievements={weeklyAchievements}
                                    selectedMonth={parseInt(selectedMonth)}
                                    year={year}
                                    view="month"
                                />
                                {monthly && (
                                    <div>
                                        <h2 className="text-lg font-semibold mb-2">{selectedMonth}월 월별 달성 현황</h2>
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100">
                                                    <th className="border p-2">지역</th>
                                                    <th className="border p-2">팀</th>
                                                    {(['A', 'B', 'C', 'D', 'F'] as (keyof WeeklyGoals)[]).map(
                                                        (step) => (
                                                            <React.Fragment key={step}>
                                                                <th className="border p-2">{step}</th>
                                                                <th className="border p-2">{`${step}_탈락`}</th>
                                                                <th className="border p-2">{`${step}_보유`}</th>
                                                            </React.Fragment>
                                                        )
                                                    )}
                                                    <th className="border p-2">총 탈락</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {monthly.achievements.map((row: TableRow) => (
                                                    <tr key={row.key}>
                                                        <td className="border p-2">{row.지역}</td>
                                                        <td className="border p-2">{row.팀}</td>
                                                        {(['A', 'B', 'C', 'D', 'F'] as (keyof WeeklyGoals)[]).map(
                                                            (step) => (
                                                                <React.Fragment key={step}>
                                                                    <td className="border p-2 text-center">
                                                                        {row[step]}
                                                                    </td>
                                                                    <td className="border p-2 text-center">
                                                                        {row[`${step}_탈락`]}
                                                                    </td>
                                                                    <td className="border p-2 text-center">
                                                                        {row[`${step}_보유`]}
                                                                    </td>
                                                                </React.Fragment>
                                                            )
                                                        )}
                                                        <td className="border p-2 text-center">{row.탈락}</td>
                                                    </tr>
                                                ))}
                                                <tr className="font-bold">
                                                    <td className="border p-2" colSpan={2}>
                                                        계
                                                    </td>
                                                    {(['A', 'B', 'C', 'D', 'F'] as (keyof WeeklyGoals)[]).map(
                                                        (step) => (
                                                            <React.Fragment key={step}>
                                                                <td className="border p-2 text-center">
                                                                    {monthly.totalRow[step]}
                                                                </td>
                                                                <td className="border p-2 text-center">
                                                                    {monthly.totalRow[`${step}_탈락`]}
                                                                </td>
                                                                <td className="border p-2 text-center">
                                                                    {monthly.totalRow[`${step}_보유`]}
                                                                </td>
                                                            </React.Fragment>
                                                        )
                                                    )}
                                                    <td className="border p-2 text-center">{monthly.totalRow.탈락}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="mt-6">
                                <RenderChart
                                    view="month"
                                    data={allRegionsResults}
                                    achievements={weeklyAchievements}
                                    selectedMonth={parseInt(selectedMonth)}
                                    year={year}
                                />
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
