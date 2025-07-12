import {
    ConversionRates,
    FGoals,
    fixedTeams,
    Region,
    REGIONS,
    Results,
    STEPS,
    Student,
    TableRow,
    TeamResult,
    WeeklyGoals,
    WeeklyPercentages,
} from './types';
import dayjs, { Dayjs } from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { Students } from '../hook/useStudentsQuery';
dayjs.extend(isBetween);

type Step = (typeof STEPS)[number];
export const initializeResults = (
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
            const percentages = weeklyPercentages[week as keyof WeeklyPercentages] ?? { A: 0, B: 0, C: 0, D: 0, F: 0 };
            return {
                A: Math.ceil(a * percentages.A),
                B: Math.ceil(b * percentages.B),
                C: Math.ceil(c * percentages.C),
                D: Math.ceil(d * percentages.D),
                F: Math.ceil(fValue * percentages.F),
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

export const getWeekDateRange = (
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
export const getTeamName = (team?: string | null): string => {
    if (!team) return '기타팀';
    const prefix = team.split('-')[0];
    return fixedTeams.find((t) => t.startsWith(prefix)) ?? '기타팀';
};

export const calculateAchievements = (
    students: Students[],
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

        // 보유 수 집계 (인도자 기준)
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

            const targets =
                step === 'A' || step === 'B'
                    ? [
                          {
                              지역: (s.인도자지역 ?? '').trim(),
                              팀: getTeamName(s.인도자팀),
                              점수: 1,
                          },
                      ]
                    : [
                          {
                              지역: (s.인도자지역 ?? '').trim(),
                              팀: getTeamName(s.인도자팀),
                              점수: 0.5,
                          },
                          {
                              지역: (s.교사지역 ?? '').trim(),
                              팀: getTeamName(s.교사팀),
                              점수: 0.5,
                          },
                      ];

            targets.forEach(({ 지역, 팀, 점수 }) => {
                if (!REGIONS.includes(지역 as Region) || !fixedTeams.includes(팀)) return;
                const teamNumber = 팀.match(/\d+/)?.[0] || 팀;

                if (mode === 'weekly') {
                    ['week1', 'week2', 'week3', 'week4'].forEach((week, index) => {
                        const { start, end } = getWeekDateRange(selectedMonth, year, index);
                        if (!date.isBetween(start, end, 'day', '[]')) return;

                        weeklyAchievements[지역] = weeklyAchievements[지역] ?? {};
                        weeklyAchievements[지역][teamNumber] = weeklyAchievements[지역][teamNumber] ?? {};
                        weeklyAchievements[지역][teamNumber][week] = weeklyAchievements[지역][teamNumber][week] ?? {};
                        weeklyAchievements[지역][teamNumber][week][mappedStep] =
                            (weeklyAchievements[지역][teamNumber][week][mappedStep] ?? 0) + 점수;
                    });
                } else if (date.month() + 1 === selectedMonth) {
                    monthlyAchievements[지역] = monthlyAchievements[지역] ?? {};
                    monthlyAchievements[지역][팀] = monthlyAchievements[지역][팀] ?? {};
                    monthlyAchievements[지역][팀][mappedStep] = (monthlyAchievements[지역][팀][mappedStep] ?? 0) + 점수;
                }
            });
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
