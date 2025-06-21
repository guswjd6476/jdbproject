'use client';
import {
    ConversionRates,
    FGoals,
    Results,
    TeamResult,
    WeeklyGoals,
    WeeklyPercentages,
    Student,
    STEPS,
    REGIONS,
    fixedTeams,
} from '@/app/lib/types';
import { useState, useEffect, useMemo } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { useStudentsQuery } from '@/app/hook/useStudentsQuery';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type Region = (typeof REGIONS)[number];

const DEFAULT_F_GOALS: Record<Region, FGoals> = {
    도봉: { team1: '4.5', team2: '4.5', team3: '4.0', team4: '3.0' },
    성북: { team1: '4.0', team2: '4.0', team3: '3.5', team4: '3.0' },
    노원: { team1: '4.5', team2: '4.5', team3: '4.0', team4: '3.0' },
    중랑: { team1: '4.0', team2: '3.5', team3: '3.5', team4: '3.0' },
    강북: { team1: '4.5', team2: '4.0', team3: '3.5', team4: '3.0' },
    대학: { team1: '5.0', team2: '4.5', team3: '4.0', team4: '3.5' },
    새신자: { team1: '3.5', team2: '3.0', team3: '3.0', team4: '2.5' },
};

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

        const weeks = ['week1', 'week2', 'week3', 'week4'].map((week) => {
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

const getWeekDateRange = (month: number, weekIndex: number): { start: Dayjs; end: Dayjs; display: string } => {
    const year = 2025;
    const firstDay = dayjs(new Date(year, month - 1, 1));
    const firstMonday = firstDay.add((8 - firstDay.day()) % 7 || 7, 'day');

    const startDate = firstMonday.add(weekIndex * 7 - 7, 'day');
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
    [step: string]: string | number;
}

export default function GoalCalculatorTable() {
    const { data: students = [], isLoading } = useStudentsQuery();

    const defaultConversionRates: ConversionRates = {
        aToB: 0.5,
        bToC: 0.5,
        cToD: 0.6,
        dToF: 0.6,
    };
    const defaultWeeklyPercentages: WeeklyPercentages = {
        week1: { A: 0.72, B: 0.21, C: 0.07, D: 0.0, F: 0.0 },
        week2: { A: 0.1, B: 0.6, C: 0.2, D: 0.05, F: 0.05 },
        week3: { A: 0.05, B: 0.05, C: 0.2, D: 0.6, F: 0.1 },
        week4: { A: 0.05, B: 0.05, C: 0.1, D: 0.1, F: 0.7 },
    };

    const [view, setView] = useState<'region' | 'month'>('region');
    const [displayMode, setDisplayMode] = useState<'table' | 'graph'>('table');
    const [region, setRegion] = useState<Region>('노원');
    const [fGoals, setFGoals] = useState<FGoals>(DEFAULT_F_GOALS['노원']);
    const [conversionRates, setConversionRates] = useState<ConversionRates>(defaultConversionRates);
    const [weeklyPercentages, setWeeklyPercentages] = useState<WeeklyPercentages>(defaultWeeklyPercentages);
    const [results, setResults] = useState<Results>(
        initializeResults(DEFAULT_F_GOALS['노원'], defaultConversionRates, defaultWeeklyPercentages)
    );
    const [error, setError] = useState<string>('');
    const [apiError, setApiError] = useState<string>('');
    const [successMessage, setSuccessMessage] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>('6');
    const year = 2025;

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
            }
        };
        fetchConfig();
    }, [region, selectedMonth, defaultConversionRates, defaultWeeklyPercentages]);

    const saveConfig = async () => {
        try {
            const response = await fetch('/api/goal', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
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
    };

    useEffect(() => {
        console.log('results state updated:', results);
    }, [results]);

    const calculateGoals = (
        currentFGoals: FGoals,
        currentConversionRates: ConversionRates,
        currentWeeklyPercentages: WeeklyPercentages
    ) => {
        const goals = Object.values(currentFGoals).map(parseFloat);
        if (goals.some((f) => isNaN(f) || f <= 0)) {
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
        Object.keys(currentWeeklyPercentages).forEach((week) => {
            const total = Object.values(currentWeeklyPercentages[week as keyof WeeklyPercentages]).reduce(
                (sum: number, p: number) => sum + p,
                0
            );
            console.log(`Week ${week} percentage sum: ${total * 100}%`);
        });

        const newResults = initializeResults(currentFGoals, currentConversionRates, currentWeeklyPercentages);
        setResults({
            teams: newResults.teams.map((team) => ({
                ...team,
                goals: { ...team.goals },
                weeks: team.weeks.map((week) => ({ ...week })),
            })),
            totals: { ...newResults.totals },
        });
        setError('');
    };

    const { monthlyAchievements, monthlyTotalRow } = useMemo(() => {
        const grouped: Record<string, Record<string, Record<string, number>>> = {};
        const 보유건Map: Record<string, number> = {};

        students.forEach((s) => {
            const 지역 = (s.인도자지역 ?? '').trim();
            const 팀 = getTeamName(s.인도자팀);
            if (!REGIONS.includes(지역) || !fixedTeams.includes(팀)) return;

            const currentStep = (s.단계 ?? '').toUpperCase();
            const mappedStep = currentStep === 'D-1' || currentStep === 'D-2' ? 'D' : currentStep;
            if (STEPS.includes(currentStep as Step)) {
                const key = `${지역}-${팀}-${mappedStep}`;
                보유건Map[key] = (보유건Map[key] ?? 0) + 1;
            }

            ['A', 'B', 'C', 'D-1', 'D-2', 'F'].forEach((step) => {
                const key = step.toLowerCase() as keyof Student;
                const dateStr = s[key] as string | null | undefined;
                if (!dateStr) return;

                const date = dayjs(dateStr);
                if (!date.isValid() || date.year() !== year || date.month() + 1 !== parseInt(selectedMonth)) return;

                const mappedStep = step === 'D-1' || step === 'D-2' ? 'D' : step;
                grouped[지역] = grouped[지역] ?? {};
                grouped[지역][팀] = grouped[지역][팀] ?? {};
                grouped[지역][팀][mappedStep] = (grouped[지역][팀][mappedStep] ?? 0) + 1;
            });

            const 탈락일Str = s.g;
            if (탈락일Str) {
                const 탈락일 = dayjs(탈락일Str);
                if (!탈락일.isValid() || 탈락일.year() !== year || 탈락일.month() + 1 !== parseInt(selectedMonth))
                    return;

                let 마지막단계: string | null = null;
                for (let i = STEPS.length - 1; i >= 0; i--) {
                    const key = STEPS[i].toLowerCase() as keyof Student;
                    if (s[key]) {
                        마지막단계 = STEPS[i];
                        break;
                    }
                }
                if (마지막단계) {
                    const mappedStep = 마지막단계 === 'D-1' || 마지막단계 === 'D-2' ? 'D' : 마지막단계;
                    const 탈락key = `${mappedStep}_탈락`;
                    grouped[지역] = grouped[지역] ?? {};
                    grouped[지역][팀] = grouped[지역][팀] ?? {};
                    grouped[지역][팀][탈락key] = (grouped[지역][팀][탈락key] ?? 0) + 1;
                    grouped[지역][팀]['탈락'] = (grouped[지역][팀]['탈락'] ?? 0) + 1;
                }
            }
        });

        const tableData: TableRow[] = [];
        REGIONS.forEach((region) => {
            const teams = fixedTeams.filter((t) => grouped[region]?.[t]);
            teams.forEach((team) => {
                const stepData = grouped[region]?.[team] || {};
                const row: TableRow = {
                    key: `${region}-${team}`,
                    지역: region,
                    팀: team,
                    탈락: stepData['탈락'] ?? 0,
                    ...['A', 'B', 'C', 'D', 'F'].reduce((acc, step) => {
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

        const totalRow: TableRow = {
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
        tableData.forEach((row) => {
            ['A', 'B', 'C', 'D', 'F'].forEach((step) => {
                totalRow[step] = (totalRow[step] as number) + (row[step] as number);
                totalRow[`${step}_탈락`] = (totalRow[`${step}_탈락`] as number) + (row[`${step}_탈락`] as number);
                totalRow[`${step}_보유`] = (totalRow[`${step}_보유`] as number) + (row[`${step}_보유`] as number);
            });
            totalRow.탈락 += row.탈락;
        });

        return { monthlyAchievements: tableData, monthlyTotalRow: totalRow };
    }, [students, selectedMonth]);

    const achievements = useMemo(() => {
        const grouped: Record<string, Record<string, Record<string, Record<string, number>>>> = {};

        ['week1', 'week2', 'week3', 'week4'].forEach((week, index) => {
            const { start, end, display } = getWeekDateRange(parseInt(selectedMonth), index);
            console.log(
                `${week} date range: ${display} (${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')})`
            );
        });

        students.forEach((s) => {
            const 지역 = (s.인도자지역 ?? '').trim();
            const 팀 = getTeamName(s.인도자팀);
            if (!REGIONS.includes(지역) || !fixedTeams.includes(팀)) return;

            ['A', 'B', 'C', 'D-1', 'D-2', 'F'].forEach((step) => {
                const key = step.toLowerCase() as keyof Student;
                const dateStr = s[key] as string | null | undefined;
                if (!dateStr) return;

                const date = dayjs(dateStr);
                if (!date.isValid() || date.year() !== year) return;

                const mappedStep = step === 'D-1' || step === 'D-2' ? 'D' : step;

                for (let weekIndex = 0; weekIndex < 4; weekIndex++) {
                    const { start, end } = getWeekDateRange(parseInt(selectedMonth), weekIndex);
                    if (date.isBefore(start, 'day') || date.isAfter(end, 'day')) continue;

                    const teamNumber = 팀.match(/\d+/)?.[0] || 팀;
                    grouped[지역] = grouped[지역] ?? {};
                    grouped[지역][teamNumber] = grouped[지역][teamNumber] ?? {};
                    grouped[지역][teamNumber][`week${weekIndex + 1}`] =
                        grouped[지역][teamNumber][`week${weekIndex + 1}`] ?? {};
                    grouped[지역][teamNumber][`week${weekIndex + 1}`][mappedStep] =
                        (grouped[지역][teamNumber][`week${weekIndex + 1}`][mappedStep] ?? 0) + 1;
                }
            });

            const 탈락일Str = s.g;
            if (탈락일Str) {
                const 탈락일 = dayjs(탈락일Str);
                if (!탈락일.isValid() || 탈락일.year() !== year || 탈락일.month() + 1 !== parseInt(selectedMonth))
                    return;

                let 마지막단계: string | null = null;
                for (let i = STEPS.length - 1; i >= 0; i--) {
                    const key = STEPS[i].toLowerCase() as keyof Student;
                    if (s[key]) {
                        마지막단계 = STEPS[i];
                        break;
                    }
                }
                if (마지막단계) {
                    const mappedStep = 마지막단계 === 'D-1' || 마지막단계 === 'D-2' ? 'D' : 마지막단계;
                    const 탈락key = `${mappedStep}_탈락`;
                    for (let weekIndex = 0; weekIndex < 4; weekIndex++) {
                        const { start, end } = getWeekDateRange(parseInt(selectedMonth), weekIndex);
                        if (탈락일.isBefore(start, 'day') || 탈락일.isAfter(end, 'day')) continue;

                        const teamNumber = 팀.match(/\d+/)?.[0] || 팀;
                        grouped[지역] = grouped[지역] ?? {};
                        grouped[지역][teamNumber] = grouped[지역][teamNumber] ?? {};
                        grouped[지역][teamNumber][`week${weekIndex + 1}`] =
                            grouped[지역][teamNumber][`week${weekIndex + 1}`] ?? {};
                        grouped[지역][teamNumber][`week${weekIndex + 1}`][탈락key] =
                            (grouped[지역][teamNumber][`week${weekIndex + 1}`][탈락key] ?? 0) + 1;
                        grouped[지역][teamNumber][`week${weekIndex + 1}`]['탈락'] =
                            (grouped[지역][teamNumber][`week${weekIndex + 1}`]['탈락'] ?? 0) + 1;
                    }
                }
            }
        });

        console.log('Grouped achievements:', JSON.stringify(grouped, null, 2));

        return grouped;
    }, [students, selectedMonth]);

    const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newRegion = e.target.value as Region;
        setRegion(newRegion);
        const newFGoals = DEFAULT_F_GOALS[newRegion];
        setFGoals(newFGoals);
        calculateGoals(newFGoals, conversionRates, weeklyPercentages);
    };

    const handleFGoalChange = (team: string, value: string) => {
        setFGoals((prev: FGoals) => {
            const newFGoals = { ...prev, [team]: value };
            calculateGoals(newFGoals, conversionRates, weeklyPercentages);
            return newFGoals;
        });
    };

    const handleConversionRateChange = (key: keyof ConversionRates, value: string) => {
        const numValue = parseInt(value) / 100;
        if (isNaN(numValue) || numValue <= 0 || numValue > 1 || !Number.isInteger(parseFloat(value))) {
            setError('단계향상률은 1~100% 사이의 정수 백분율이어야 합니다.');
            return;
        }
        setConversionRates((prev: ConversionRates) => {
            const newConversionRates = { ...prev, [key]: numValue };
            calculateGoals(fGoals, newConversionRates, weeklyPercentages);
            return newConversionRates;
        });
    };

    const handleWeeklyPercentageChange = (week: keyof WeeklyPercentages, key: keyof WeeklyGoals, value: string) => {
        const num = Number(value);
        if (isNaN(num) || num < 0 || num > 100 || !Number.isInteger(num)) {
            setError('비율은 0~100% 사이의 정수 백분율이어야 합니다.');
            return;
        }
        setWeeklyPercentages((prev: WeeklyPercentages) => {
            const currentWeek = { ...prev[week] };
            const newValue = num / 100;
            currentWeek[key] = newValue;
            if (newValue === 1) {
                (['A', 'B', 'C', 'D', 'F'] as (keyof WeeklyGoals)[]).forEach((k) => {
                    if (k !== key) currentWeek[k] = 0;
                });
            }
            const newWeeklyPercentages = { ...prev, [week]: currentWeek };
            calculateGoals(fGoals, conversionRates, newWeeklyPercentages);
            return newWeeklyPercentages;
        });
        setError('');
    };

    const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedMonth(e.target.value);
    };

    const allRegionsResults = useMemo(() => {
        const resultsByRegion: { region: Region; results: Results }[] = [];
        REGIONS.forEach((reg) => {
            const fetchConfig = async () => {
                try {
                    const response = await fetch(`/api/goal?region=${reg}&month=${selectedMonth}&year=${year}`);
                    const result = await response.json();
                    if (result.data) {
                        return initializeResults(
                            result.data.f_goals,
                            result.data.conversion_rates,
                            result.data.weekly_percentages
                        );
                    } else {
                        return initializeResults(
                            DEFAULT_F_GOALS[reg],
                            defaultConversionRates,
                            defaultWeeklyPercentages
                        );
                    }
                } catch (err) {
                    console.error(`Fetch config error for ${reg}:`, err);
                    return initializeResults(DEFAULT_F_GOALS[reg], defaultConversionRates, defaultWeeklyPercentages);
                }
            };
            fetchConfig().then((res) => {
                resultsByRegion.push({ region: reg, results: res });
            });
        });
        return resultsByRegion;
    }, [selectedMonth]);

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

    const renderRegionChart = () => {
        const weeks = ['week1', 'week2', 'week3', 'week4'] as (keyof WeeklyPercentages)[];
        const labels = results.teams.map((team) => `${region} ${team.team}팀`);

        return weeks.map((week, weekIndex) => {
            const { display } = getWeekDateRange(parseInt(selectedMonth), weekIndex);

            const data = {
                labels,
                datasets: [
                    {
                        label: 'A 단계 목표',
                        data: results.teams.map((team) => team.weeks[weekIndex].A),
                        backgroundColor: 'rgba(54, 162, 235, 0.3)', // Light Blue
                        borderColor: 'rgba(54, 162, 235, 0.8)',
                        borderWidth: 1,
                    },
                    {
                        label: 'A 단계 달성',
                        data: results.teams.map((team) => achievements[region]?.[`${team.team}`]?.[week]?.A || 0),
                        backgroundColor: 'rgba(54, 162, 235, 0.7)', // Blue
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1,
                    },
                    {
                        label: 'B 단계 목표',
                        data: results.teams.map((team) => team.weeks[weekIndex].B),
                        backgroundColor: 'rgba(75, 192, 192, 0.3)', // Light Teal
                        borderColor: 'rgba(75, 192, 192, 0.8)',
                        borderWidth: 1,
                    },
                    {
                        label: 'B 단계 달성',
                        data: results.teams.map((team) => achievements[region]?.[`${team.team}`]?.[week]?.B || 0),
                        backgroundColor: 'rgba(75, 192, 192, 0.7)', // Teal
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1,
                    },
                    {
                        label: 'C 단계 목표',
                        data: results.teams.map((team) => team.weeks[weekIndex].C),
                        backgroundColor: 'rgba(255, 159, 64, 0.3)', // Light Orange
                        borderColor: 'rgba(255, 159, 64, 0.8)',
                        borderWidth: 1,
                    },
                    {
                        label: 'C 단계 달성',
                        data: results.teams.map((team) => achievements[region]?.[`${team.team}`]?.[week]?.C || 0),
                        backgroundColor: 'rgba(255, 159, 64, 0.7)', // Orange
                        borderColor: 'rgba(255, 159, 64, 1)',
                        borderWidth: 1,
                    },
                    {
                        label: 'D 단계 목표',
                        data: results.teams.map((team) => team.weeks[weekIndex].D),
                        backgroundColor: 'rgba(153, 102, 255, 0.3)', // Light Purple
                        borderColor: 'rgba(153, 102, 255, 0.8)',
                        borderWidth: 1,
                    },
                    {
                        label: 'D 단계 달성',
                        data: results.teams.map((team) => achievements[region]?.[`${team.team}`]?.[week]?.D || 0),
                        backgroundColor: 'rgba(153, 102, 255, 0.7)', // Purple
                        borderColor: 'rgba(153, 102, 255, 1)',
                        borderWidth: 1,
                    },
                    {
                        label: 'F 단계 목표',
                        data: results.teams.map((team) => team.weeks[weekIndex].F),
                        backgroundColor: 'rgba(255, 206, 86, 0.3)', // Light Yellow
                        borderColor: 'rgba(255, 206, 86, 0.8)',
                        borderWidth: 1,
                    },
                    {
                        label: 'F 단계 달성',
                        data: results.teams.map((team) => achievements[region]?.[`${team.team}`]?.[week]?.F || 0),
                        backgroundColor: 'rgba(255, 206, 86, 0.7)', // Yellow
                        borderColor: 'rgba(255, 206, 86, 1)',
                        borderWidth: 1,
                    },
                ],
            };

            const options = {
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '수',
                        },
                    },
                    x: {
                        title: {
                            display: true,
                            text: '팀',
                        },
                    },
                },
                plugins: {
                    legend: {
                        position: 'top' as const,
                    },
                    title: {
                        display: true,
                        text: `${selectedMonth}월 ${
                            weekIndex + 1
                        }주차 (${display}) ${region} 팀별 A, B, C, D, F 단계 목표 vs 달성`,
                    },
                },
            };

            return (
                <div key={week} className="mb-8">
                    <h3 className="text-md font-medium mb-4">
                        {weekIndex + 1}주차 ({display})
                    </h3>
                    <Bar data={data} options={options} />
                </div>
            );
        });
    };

    const renderMonthChart = (monthlyAchievements: TableRow[]) => {
        const weeks = ['week1', 'week2', 'week3', 'week4'] as (keyof WeeklyPercentages)[];
        const labels = monthlyAchievements.map((row: TableRow) => `${row.지역} ${row.팀}`);

        return weeks.map((week, weekIndex) => {
            const { display } = getWeekDateRange(parseInt(selectedMonth), weekIndex);

            // Aggregate weekly data for A, B, C, D, F achievements
            const weeklyAchievements = monthlyAchievements.map((row: TableRow) => {
                const region = row.지역;
                const team = row.팀;
                const teamNumber = team.match(/\d+/)?.[0] || team;
                const weekAchievements = achievements[region]?.[teamNumber]?.[week] || {};
                return {
                    A: weekAchievements.A || 0,
                    B: weekAchievements.B || 0,
                    C: weekAchievements.C || 0,
                    D: weekAchievements.D || 0,
                    F: weekAchievements.F || 0,
                };
            });

            // Aggregate weekly goals from allRegionsResults
            const weeklyGoals = monthlyAchievements.map((row: TableRow) => {
                const region = row.지역;
                const team = row.팀;
                const teamNumber = parseInt(team.match(/\d+/)?.[0] || '0');
                const regionResults = allRegionsResults.find((r) => r.region === region)?.results;
                const teamResult = regionResults?.teams.find((t) => t.team === teamNumber);
                return {
                    A: teamResult?.weeks[weekIndex].A || 0,
                    B: teamResult?.weeks[weekIndex].B || 0,
                    C: teamResult?.weeks[weekIndex].C || 0,
                    D: teamResult?.weeks[weekIndex].D || 0,
                    F: teamResult?.weeks[weekIndex].F || 0,
                };
            });

            const data = {
                labels,
                datasets: [
                    {
                        label: 'A 단계 목표',
                        data: weeklyGoals.map((data) => data.A),
                        backgroundColor: 'rgba(54, 162, 235, 0.3)', // Light Blue
                        borderColor: 'rgba(54, 162, 235, 0.8)',
                        borderWidth: 1,
                    },
                    {
                        label: 'A 단계 달성',
                        data: weeklyAchievements.map((data) => data.A),
                        backgroundColor: 'rgba(54, 162, 235, 0.7)', // Blue
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1,
                    },
                    {
                        label: 'B 단계 목표',
                        data: weeklyGoals.map((data) => data.B),
                        backgroundColor: 'rgba(75, 192, 192, 0.3)', // Light Teal
                        borderColor: 'rgba(75, 192, 192, 0.8)',
                        borderWidth: 1,
                    },
                    {
                        label: 'B 단계 달성',
                        data: weeklyAchievements.map((data) => data.B),
                        backgroundColor: 'rgba(75, 192, 192, 0.7)', // Teal
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1,
                    },
                    {
                        label: 'C 단계 목표',
                        data: weeklyGoals.map((data) => data.C),
                        backgroundColor: 'rgba(255, 159, 64, 0.3)', // Light Orange
                        borderColor: 'rgba(255, 159, 64, 0.8)',
                        borderWidth: 1,
                    },
                    {
                        label: 'C 단계 달성',
                        data: weeklyAchievements.map((data) => data.C),
                        backgroundColor: 'rgba(255, 159, 64, 0.7)', // Orange
                        borderColor: 'rgba(255, 159, 64, 1)',
                        borderWidth: 1,
                    },
                    {
                        label: 'D 단계 목표',
                        data: weeklyGoals.map((data) => data.D),
                        backgroundColor: 'rgba(153, 102, 255, 0.3)', // Light Purple
                        borderColor: 'rgba(153, 102, 255, 0.8)',
                        borderWidth: 1,
                    },
                    {
                        label: 'D 단계 달성',
                        data: weeklyAchievements.map((data) => data.D),
                        backgroundColor: 'rgba(153, 102, 255, 0.7)', // Purple
                        borderColor: 'rgba(153, 102, 255, 1)',
                        borderWidth: 1,
                    },
                    {
                        label: 'F 단계 목표',
                        data: weeklyGoals.map((data) => data.F),
                        backgroundColor: 'rgba(255, 206, 86, 0.3)', // Light Yellow
                        borderColor: 'rgba(255, 206, 86, 0.8)',
                        borderWidth: 1,
                    },
                    {
                        label: 'F 단계 달성',
                        data: weeklyAchievements.map((data) => data.F),
                        backgroundColor: 'rgba(255, 206, 86, 0.7)', // Yellow
                        borderColor: 'rgba(255, 206, 86, 1)',
                        borderWidth: 1,
                    },
                ],
            };

            const options = {
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '수',
                        },
                    },
                    x: {
                        title: {
                            display: true,
                            text: '지역 및 팀',
                        },
                    },
                },
                plugins: {
                    legend: {
                        position: 'top' as const,
                    },
                    title: {
                        display: true,
                        text: `${selectedMonth}월 ${
                            weekIndex + 1
                        }주차 (${display}) 지역별 A, B, C, D, F 단계 목표 vs 달성`,
                    },
                },
            };

            return (
                <div key={week} className="mb-8">
                    <h3 className="text-md font-medium mb-4">
                        {weekIndex + 1}주차 ({display})
                    </h3>
                    <Bar data={data} options={options} />
                </div>
            );
        });
    };

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
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
                                    onChange={(e) => handleFGoalChange(team, e.target.value)}
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
                                                                handleConversionRateChange(key, e.target.value)
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
                                                                handleWeeklyPercentageChange(
                                                                    week as keyof WeeklyPercentages,
                                                                    key,
                                                                    e.target.value
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
                                {(['week1', 'week2', 'week3', 'week4'] as (keyof WeeklyPercentages)[]).map(
                                    (week, weekIndex) => {
                                        const { display } = getWeekDateRange(parseInt(selectedMonth), weekIndex);
                                        const totalAchievements = results.teams.reduce(
                                            (acc: WeeklyGoals, team: TeamResult) => {
                                                const teamAch = achievements[region]?.[`${team.team}`]?.[week] || {};
                                                return {
                                                    A: acc.A + (teamAch.A || 0),
                                                    B: acc.B + (teamAch.B || 0),
                                                    C: acc.C + (teamAch.C || 0),
                                                    D: acc.D + (teamAch.D || 0),
                                                    F: acc.F + (teamAch.F || 0),
                                                };
                                            },
                                            { A: 0, B: 0, C: 0, D: 0, F: 0 }
                                        );

                                        return (
                                            <div key={week} className="mb-6">
                                                <h3 className="text-md font-medium mb-2">
                                                    {weekIndex + 1}주차 ({display})
                                                </h3>
                                                <table className="w-full border-collapse">
                                                    <thead>
                                                        <tr className="bg-gray-100">
                                                            <th className="border p-2">지역</th>
                                                            <th className="border p-2" colSpan={3}>
                                                                A
                                                            </th>
                                                            <th className="border p-2" colSpan={3}>
                                                                B
                                                            </th>
                                                            <th className="border p-2" colSpan={3}>
                                                                C
                                                            </th>
                                                            <th className="border p-2" colSpan={3}>
                                                                D
                                                            </th>
                                                            <th className="border p-2" colSpan={3}>
                                                                F
                                                            </th>
                                                        </tr>
                                                        <tr className="bg-gray-50">
                                                            <th className="border p-2"></th>
                                                            <th className="border p-2">목표</th>
                                                            <th className="border p-2">달성</th>
                                                            <th className="border p-2">달성률</th>
                                                            <th className="border p-2">목표</th>
                                                            <th className="border p-2">달성</th>
                                                            <th className="border p-2">달성률</th>
                                                            <th className="border p-2">목표</th>
                                                            <th className="border p-2">달성</th>
                                                            <th className="border p-2">달성률</th>
                                                            <th className="border p-2">목표</th>
                                                            <th className="border p-2">달성</th>
                                                            <th className="border p-2">달성률</th>
                                                            <th className="border p-2">목표</th>
                                                            <th className="border p-2">달성</th>
                                                            <th className="border p-2">달성률</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {results.teams.map((team: TeamResult) => {
                                                            const teamAch =
                                                                achievements[region]?.[`${team.team}`]?.[week] || {};
                                                            return (
                                                                <tr key={team.team}>
                                                                    <td className="border p-2">
                                                                        {region} {team.team}팀
                                                                    </td>
                                                                    <td className="border p-2 text-center">
                                                                        {team.weeks[weekIndex].A}
                                                                    </td>
                                                                    <td className="border p-2 text-center">
                                                                        {teamAch.A || 0}
                                                                    </td>
                                                                    <td className="border p-2 text-center">
                                                                        {team.weeks[weekIndex].A > 0
                                                                            ? (
                                                                                  ((teamAch.A || 0) /
                                                                                      team.weeks[weekIndex].A) *
                                                                                  100
                                                                              ).toFixed(2) + '%'
                                                                            : '0.00%'}
                                                                    </td>
                                                                    <td className="border p-2 text-center">
                                                                        {team.weeks[weekIndex].B}
                                                                    </td>
                                                                    <td className="border p-2 text-center">
                                                                        {teamAch.B || 0}
                                                                    </td>
                                                                    <td className="border p-2 text-center">
                                                                        {team.weeks[weekIndex].B > 0
                                                                            ? (
                                                                                  ((teamAch.B || 0) /
                                                                                      team.weeks[weekIndex].B) *
                                                                                  100
                                                                              ).toFixed(2) + '%'
                                                                            : '0.00%'}
                                                                    </td>
                                                                    <td className="border p-2 text-center">
                                                                        {team.weeks[weekIndex].C}
                                                                    </td>
                                                                    <td className="border p-2 text-center">
                                                                        {teamAch.C || 0}
                                                                    </td>
                                                                    <td className="border p-2 text-center">
                                                                        {team.weeks[weekIndex].C > 0
                                                                            ? (
                                                                                  ((teamAch.C || 0) /
                                                                                      team.weeks[weekIndex].C) *
                                                                                  100
                                                                              ).toFixed(2) + '%'
                                                                            : '0.00%'}
                                                                    </td>
                                                                    <td className="border p-2 text-center">
                                                                        {team.weeks[weekIndex].D}
                                                                    </td>
                                                                    <td className="border p-2 text-center">
                                                                        {teamAch.D || 0}
                                                                    </td>
                                                                    <td className="border p-2 text-center">
                                                                        {team.weeks[weekIndex].D > 0
                                                                            ? (
                                                                                  ((teamAch.D || 0) /
                                                                                      team.weeks[weekIndex].D) *
                                                                                  100
                                                                              ).toFixed(2) + '%'
                                                                            : '0.00%'}
                                                                    </td>
                                                                    <td className="border p-2 text-center">
                                                                        {team.weeks[weekIndex].F}
                                                                    </td>
                                                                    <td className="border p-2 text-center">
                                                                        {teamAch.F || 0}
                                                                    </td>
                                                                    <td className="border p-2 text-center">
                                                                        {team.weeks[weekIndex].F > 0
                                                                            ? (
                                                                                  ((teamAch.F || 0) /
                                                                                      team.weeks[weekIndex].F) *
                                                                                  100
                                                                              ).toFixed(2) + '%'
                                                                            : '0.00%'}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                        <tr className="font-bold">
                                                            <td className="border p-2">계</td>
                                                            <td className="border p-2 text-center">
                                                                {results.teams.reduce(
                                                                    (sum: number, team: TeamResult) =>
                                                                        sum + team.weeks[weekIndex].A,
                                                                    0
                                                                )}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {totalAchievements.A}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {results.teams.reduce(
                                                                    (sum: number, team: TeamResult) =>
                                                                        sum + team.weeks[weekIndex].A,
                                                                    0
                                                                ) > 0
                                                                    ? (
                                                                          (totalAchievements.A /
                                                                              results.teams.reduce(
                                                                                  (sum: number, team: TeamResult) =>
                                                                                      sum + team.weeks[weekIndex].A,
                                                                                  0
                                                                              )) *
                                                                          100
                                                                      ).toFixed(2) + '%'
                                                                    : '0.00%'}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {results.teams.reduce(
                                                                    (sum: number, team: TeamResult) =>
                                                                        sum + team.weeks[weekIndex].B,
                                                                    0
                                                                )}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {totalAchievements.B}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {results.teams.reduce(
                                                                    (sum: number, team: TeamResult) =>
                                                                        sum + team.weeks[weekIndex].B,
                                                                    0
                                                                ) > 0
                                                                    ? (
                                                                          (totalAchievements.B /
                                                                              results.teams.reduce(
                                                                                  (sum: number, team: TeamResult) =>
                                                                                      sum + team.weeks[weekIndex].B,
                                                                                  0
                                                                              )) *
                                                                          100
                                                                      ).toFixed(2) + '%'
                                                                    : '0.00%'}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {results.teams.reduce(
                                                                    (sum: number, team: TeamResult) =>
                                                                        sum + team.weeks[weekIndex].C,
                                                                    0
                                                                )}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {totalAchievements.C}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {results.teams.reduce(
                                                                    (sum: number, team: TeamResult) =>
                                                                        sum + team.weeks[weekIndex].C,
                                                                    0
                                                                ) > 0
                                                                    ? (
                                                                          (totalAchievements.C /
                                                                              results.teams.reduce(
                                                                                  (sum: number, team: TeamResult) =>
                                                                                      sum + team.weeks[weekIndex].C,
                                                                                  0
                                                                              )) *
                                                                          100
                                                                      ).toFixed(2) + '%'
                                                                    : '0.00%'}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {results.teams.reduce(
                                                                    (sum: number, team: TeamResult) =>
                                                                        sum + team.weeks[weekIndex].D,
                                                                    0
                                                                )}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {totalAchievements.D}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {results.teams.reduce(
                                                                    (sum: number, team: TeamResult) =>
                                                                        sum + team.weeks[weekIndex].D,
                                                                    0
                                                                ) > 0
                                                                    ? (
                                                                          (totalAchievements.D /
                                                                              results.teams.reduce(
                                                                                  (sum: number, team: TeamResult) =>
                                                                                      sum + team.weeks[weekIndex].D,
                                                                                  0
                                                                              )) *
                                                                          100
                                                                      ).toFixed(2) + '%'
                                                                    : '0.00%'}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {results.teams.reduce(
                                                                    (sum: number, team: TeamResult) =>
                                                                        sum + team.weeks[weekIndex].F,
                                                                    0
                                                                )}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {totalAchievements.F}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {results.teams.reduce(
                                                                    (sum: number, team: TeamResult) =>
                                                                        sum + team.weeks[weekIndex].F,
                                                                    0
                                                                ) > 0
                                                                    ? (
                                                                          (totalAchievements.F /
                                                                              results.teams.reduce(
                                                                                  (sum: number, team: TeamResult) =>
                                                                                      sum + team.weeks[weekIndex].F,
                                                                                  0
                                                                              )) *
                                                                          100
                                                                      ).toFixed(2) + '%'
                                                                    : '0.00%'}
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        );
                                    }
                                )}
                            </>
                        ) : (
                            <div className="mt-6">{renderRegionChart()}</div>
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
                                {(['week1', 'week2', 'week3', 'week4'] as (keyof WeeklyPercentages)[]).map(
                                    (week, weekIndex) => {
                                        const { display } = getWeekDateRange(parseInt(selectedMonth), weekIndex);
                                        const totalAchievements = allRegionsResults.reduce(
                                            (acc: WeeklyGoals, { region: reg }) => {
                                                const regionTeams =
                                                    allRegionsResults.find((r) => r.region === reg)?.results.teams ||
                                                    [];
                                                const teamSums = regionTeams.reduce(
                                                    (teamAcc: WeeklyGoals, team: TeamResult) => {
                                                        const teamAch =
                                                            achievements[reg]?.[`${team.team}`]?.[week] || {};
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

                                        return (
                                            <div key={week} className="mb-6">
                                                <h3 className="text-md font-medium mb-2">
                                                    {weekIndex + 1}주차 ({display})
                                                </h3>
                                                <table className="w-full border-collapse">
                                                    <thead>
                                                        <tr className="bg-gray-100">
                                                            <th className="border p-2">지역</th>
                                                            <th className="border p-2" colSpan={3}>
                                                                A
                                                            </th>
                                                            <th className="border p-2" colSpan={3}>
                                                                B
                                                            </th>
                                                            <th className="border p-2" colSpan={3}>
                                                                C
                                                            </th>
                                                            <th className="border p-2" colSpan={3}>
                                                                D
                                                            </th>
                                                            <th className="border p-2" colSpan={3}>
                                                                F
                                                            </th>
                                                        </tr>
                                                        <tr className="bg-gray-50">
                                                            <th className="border p-2"></th>
                                                            <th className="border p-2">목표</th>
                                                            <th className="border p-2">달성</th>
                                                            <th className="border p-2">달성률</th>
                                                            <th className="border p-2">목표</th>
                                                            <th className="border p-2">달성</th>
                                                            <th className="border p-2">달성률</th>
                                                            <th className="border p-2">목표</th>
                                                            <th className="border p-2">달성</th>
                                                            <th className="border p-2">달성률</th>
                                                            <th className="border p-2">목표</th>
                                                            <th className="border p-2">달성</th>
                                                            <th className="border p-2">달성률</th>
                                                            <th className="border p-2">목표</th>
                                                            <th className="border p-2">달성</th>
                                                            <th className="border p-2">달성률</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {allRegionsResults.flatMap(({ region: reg, results: res }) =>
                                                            res.teams.map((team: TeamResult) => {
                                                                const teamAch =
                                                                    achievements[reg]?.[`${team.team}`]?.[week] || {};
                                                                return (
                                                                    <tr key={`${reg}-${team.team}`}>
                                                                        <td className="border p-2">
                                                                            {reg} {team.team}팀
                                                                        </td>
                                                                        <td className="border p-2 text-center">
                                                                            {team.weeks[weekIndex].A}
                                                                        </td>
                                                                        <td className="border p-2 text-center">
                                                                            {teamAch.A || 0}
                                                                        </td>
                                                                        <td className="border p-2 text-center">
                                                                            {team.weeks[weekIndex].A > 0
                                                                                ? (
                                                                                      ((teamAch.A || 0) /
                                                                                          team.weeks[weekIndex].A) *
                                                                                      100
                                                                                  ).toFixed(2) + '%'
                                                                                : '0.00%'}
                                                                        </td>
                                                                        <td className="border p-2 text-center">
                                                                            {team.weeks[weekIndex].B}
                                                                        </td>
                                                                        <td className="border p-2 text-center">
                                                                            {teamAch.B || 0}
                                                                        </td>
                                                                        <td className="border p-2 text-center">
                                                                            {team.weeks[weekIndex].B > 0
                                                                                ? (
                                                                                      ((teamAch.B || 0) /
                                                                                          team.weeks[weekIndex].B) *
                                                                                      100
                                                                                  ).toFixed(2) + '%'
                                                                                : '0.00%'}
                                                                        </td>
                                                                        <td className="border p-2 text-center">
                                                                            {team.weeks[weekIndex].C}
                                                                        </td>
                                                                        <td className="border p-2 text-center">
                                                                            {teamAch.C || 0}
                                                                        </td>
                                                                        <td className="border p-2 text-center">
                                                                            {team.weeks[weekIndex].C > 0
                                                                                ? (
                                                                                      ((teamAch.C || 0) /
                                                                                          team.weeks[weekIndex].C) *
                                                                                      100
                                                                                  ).toFixed(2) + '%'
                                                                                : '0.00%'}
                                                                        </td>
                                                                        <td className="border p-2 text-center">
                                                                            {team.weeks[weekIndex].D}
                                                                        </td>
                                                                        <td className="border p-2 text-center">
                                                                            {teamAch.D || 0}
                                                                        </td>
                                                                        <td className="border p-2 text-center">
                                                                            {team.weeks[weekIndex].D > 0
                                                                                ? (
                                                                                      ((teamAch.D || 0) /
                                                                                          team.weeks[weekIndex].D) *
                                                                                      100
                                                                                  ).toFixed(2) + '%'
                                                                                : '0.00%'}
                                                                        </td>
                                                                        <td className="border p-2 text-center">
                                                                            {team.weeks[weekIndex].F}
                                                                        </td>
                                                                        <td className="border p-2 text-center">
                                                                            {teamAch.F || 0}
                                                                        </td>
                                                                        <td className="border p-2 text-center">
                                                                            {team.weeks[weekIndex].F > 0
                                                                                ? (
                                                                                      ((teamAch.F || 0) /
                                                                                          team.weeks[weekIndex].F) *
                                                                                      100
                                                                                  ).toFixed(2) + '%'
                                                                                : '0.00%'}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })
                                                        )}
                                                        <tr className="font-bold">
                                                            <td className="border p-2">계</td>
                                                            <td className="border p-2 text-center">
                                                                {allRegionsResults.reduce(
                                                                    (sum, { results }) =>
                                                                        sum +
                                                                        results.teams.reduce(
                                                                            (teamSum, team) =>
                                                                                teamSum + team.weeks[weekIndex].A,
                                                                            0
                                                                        ),
                                                                    0
                                                                )}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {totalAchievements.A}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {allRegionsResults.reduce(
                                                                    (sum, { results }) =>
                                                                        sum +
                                                                        results.teams.reduce(
                                                                            (teamSum, team) =>
                                                                                teamSum + team.weeks[weekIndex].A,
                                                                            0
                                                                        ),
                                                                    0
                                                                ) > 0
                                                                    ? (
                                                                          (totalAchievements.A /
                                                                              allRegionsResults.reduce(
                                                                                  (sum, { results }) =>
                                                                                      sum +
                                                                                      results.teams.reduce(
                                                                                          (teamSum, team) =>
                                                                                              teamSum +
                                                                                              team.weeks[weekIndex].A,
                                                                                          0
                                                                                      ),
                                                                                  0
                                                                              )) *
                                                                          100
                                                                      ).toFixed(2) + '%'
                                                                    : '0.00%'}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {allRegionsResults.reduce(
                                                                    (sum, { results }) =>
                                                                        sum +
                                                                        results.teams.reduce(
                                                                            (teamSum, team) =>
                                                                                teamSum + team.weeks[weekIndex].B,
                                                                            0
                                                                        ),
                                                                    0
                                                                )}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {totalAchievements.B}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {allRegionsResults.reduce(
                                                                    (sum, { results }) =>
                                                                        sum +
                                                                        results.teams.reduce(
                                                                            (teamSum, team) =>
                                                                                teamSum + team.weeks[weekIndex].B,
                                                                            0
                                                                        ),
                                                                    0
                                                                ) > 0
                                                                    ? (
                                                                          (totalAchievements.B /
                                                                              allRegionsResults.reduce(
                                                                                  (sum, { results }) =>
                                                                                      sum +
                                                                                      results.teams.reduce(
                                                                                          (teamSum, team) =>
                                                                                              teamSum +
                                                                                              team.weeks[weekIndex].B,
                                                                                          0
                                                                                      ),
                                                                                  0
                                                                              )) *
                                                                          100
                                                                      ).toFixed(2) + '%'
                                                                    : '0.00%'}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {allRegionsResults.reduce(
                                                                    (sum, { results }) =>
                                                                        sum +
                                                                        results.teams.reduce(
                                                                            (teamSum, team) =>
                                                                                teamSum + team.weeks[weekIndex].C,
                                                                            0
                                                                        ),
                                                                    0
                                                                )}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {totalAchievements.C}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {allRegionsResults.reduce(
                                                                    (sum, { results }) =>
                                                                        sum +
                                                                        results.teams.reduce(
                                                                            (teamSum, team) =>
                                                                                teamSum + team.weeks[weekIndex].C,
                                                                            0
                                                                        ),
                                                                    0
                                                                ) > 0
                                                                    ? (
                                                                          (totalAchievements.C /
                                                                              allRegionsResults.reduce(
                                                                                  (sum, { results }) =>
                                                                                      sum +
                                                                                      results.teams.reduce(
                                                                                          (teamSum, team) =>
                                                                                              teamSum +
                                                                                              team.weeks[weekIndex].C,
                                                                                          0
                                                                                      ),
                                                                                  0
                                                                              )) *
                                                                          100
                                                                      ).toFixed(2) + '%'
                                                                    : '0.00%'}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {allRegionsResults.reduce(
                                                                    (sum, { results }) =>
                                                                        sum +
                                                                        results.teams.reduce(
                                                                            (teamSum, team) =>
                                                                                teamSum + team.weeks[weekIndex].D,
                                                                            0
                                                                        ),
                                                                    0
                                                                )}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {totalAchievements.D}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {allRegionsResults.reduce(
                                                                    (sum, { results }) =>
                                                                        sum +
                                                                        results.teams.reduce(
                                                                            (teamSum, team) =>
                                                                                teamSum + team.weeks[weekIndex].D,
                                                                            0
                                                                        ),
                                                                    0
                                                                ) > 0
                                                                    ? (
                                                                          (totalAchievements.D /
                                                                              allRegionsResults.reduce(
                                                                                  (sum, { results }) =>
                                                                                      sum +
                                                                                      results.teams.reduce(
                                                                                          (teamSum, team) =>
                                                                                              teamSum +
                                                                                              team.weeks[weekIndex].D,
                                                                                          0
                                                                                      ),
                                                                                  0
                                                                              )) *
                                                                          100
                                                                      ).toFixed(2) + '%'
                                                                    : '0.00%'}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {allRegionsResults.reduce(
                                                                    (sum, { results }) =>
                                                                        sum +
                                                                        results.teams.reduce(
                                                                            (teamSum, team) =>
                                                                                teamSum + team.weeks[weekIndex].F,
                                                                            0
                                                                        ),
                                                                    0
                                                                )}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {totalAchievements.F}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {allRegionsResults.reduce(
                                                                    (sum, { results }) =>
                                                                        sum +
                                                                        results.teams.reduce(
                                                                            (teamSum, team) =>
                                                                                teamSum + team.weeks[weekIndex].F,
                                                                            0
                                                                        ),
                                                                    0
                                                                ) > 0
                                                                    ? (
                                                                          (totalAchievements.F /
                                                                              allRegionsResults.reduce(
                                                                                  (sum, { results }) =>
                                                                                      sum +
                                                                                      results.teams.reduce(
                                                                                          (teamSum, team) =>
                                                                                              teamSum +
                                                                                              team.weeks[weekIndex].F,
                                                                                          0
                                                                                      ),
                                                                                  0
                                                                              )) *
                                                                          100
                                                                      ).toFixed(2) + '%'
                                                                    : '0.00%'}
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        );
                                    }
                                )}

                                <h2 className="text-lg font-semibold mb-2">{selectedMonth}월 월별 달성 현황</h2>
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="border p-2">지역</th>
                                            <th className="border p-2">팀</th>
                                            {['A', 'B', 'C', 'D', 'F'].flatMap((step) => [
                                                <th key={step} className="border p-2">
                                                    {step}
                                                </th>,
                                                <th key={`${step}_탈락`} className="border p-2">{`${step}_탈락`}</th>,
                                                <th key={`${step}_보유`} className="border p-2">{`${step}_보유`}</th>,
                                            ])}
                                            <th className="border p-2">총 탈락</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {monthlyAchievements.map((row: TableRow) => (
                                            <tr key={row.key}>
                                                <td className="border p-2">{row.지역}</td>
                                                <td className="border p-2">{row.팀}</td>
                                                {['A', 'B', 'C', 'D', 'F'].flatMap((step) => [
                                                    <td key={step} className="border p-2 text-center">
                                                        {row[step]}
                                                    </td>,
                                                    <td key={`${step}_탈락`} className="border p-2 text-center">
                                                        {row[`${step}_탈락`]}
                                                    </td>,
                                                    <td key={`${step}_보유`} className="border p-2 text-center">
                                                        {row[`${step}_보유`]}
                                                    </td>,
                                                ])}
                                                <td className="border p-2 text-center">{row.탈락}</td>
                                            </tr>
                                        ))}
                                        <tr className="font-bold">
                                            <td className="border p-2" colSpan={2}>
                                                계
                                            </td>
                                            {['A', 'B', 'C', 'D', 'F'].flatMap((step) => [
                                                <td key={step} className="border p-2 text-center">
                                                    {monthlyTotalRow[step]}
                                                </td>,
                                                <td key={`${step}_탈락`} className="border p-2 text-center">
                                                    {monthlyTotalRow[`${step}_탈락`]}
                                                </td>,
                                                <td key={`${step}_보유`} className="border p-2 text-center">
                                                    {monthlyTotalRow[`${step}_보유`]}
                                                </td>,
                                            ])}
                                            <td className="border p-2 text-center">{monthlyTotalRow.탈락}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </>
                        ) : (
                            <div className="mt-6">{renderMonthChart(monthlyAchievements)}</div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
