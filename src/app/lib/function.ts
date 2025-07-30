import {
    ConversionRates,
    예정Goals,
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

export const initializeResults = (
    예정Goals: 예정Goals,
    conversionRates: ConversionRates,
    weeklyPercentages: WeeklyPercentages
): Results => {
    const goals = Object.values(예정Goals).map((f) => parseFloat(f));

    const teamResults: TeamResult[] = goals.map((예정Value, index) => {
        const 복 = Math.ceil(예정Value / conversionRates.복To예정);
        const 섭 = Math.ceil(복 / conversionRates.섭To복);
        const 합 = Math.ceil(섭 / conversionRates.합To섭);
        const 찾 = Math.ceil(합 / conversionRates.찾To합);
        const 발 = Math.ceil(찾 / conversionRates.발To찾);

        const weeks = ['week1', 'week2', 'week3', 'week4', 'week5'].map((week) => {
            const percentages = weeklyPercentages[week as keyof WeeklyPercentages] ?? {
                발: 0,
                찾: 0,
                합: 0,
                섭: 0,
                복: 0,
                예정: 0,
            };
            return {
                발: Math.ceil(발 * percentages.발),
                찾: Math.ceil(찾 * percentages.찾),
                합: Math.ceil(합 * percentages.합),
                섭: Math.ceil(섭 * percentages.섭),
                복: Math.ceil(복 * percentages.복),
                예정: Math.ceil(예정Value * percentages.예정),
            };
        });

        return { team: index + 1, goals: { 발: 발, 찾: 찾, 합: 합, 섭: 섭, 복: 복, 예정: 예정Value }, weeks };
    });

    // DEBUG: '복'의 총합이 '예정' 값으로 더해지던 오류 수정 및 acc 타입 명시
    const totals: WeeklyGoals = teamResults.reduce(
        (acc: WeeklyGoals, team: TeamResult) => ({
            발: acc.발 + team.goals.발,
            찾: acc.찾 + team.goals.찾,
            합: acc.합 + team.goals.합,
            섭: acc.섭 + team.goals.섭,
            복: acc.복 + team.goals.복, // 'team.goals.예정' -> 'team.goals.복' 으로 수정
            예정: acc.예정 + team.goals.예정,
        }),
        { 발: 0, 찾: 0, 합: 0, 섭: 0, 복: 0, 예정: 0 }
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

    // 2025년 9월부터는 3주 전, 그 전은 2주 전으로 기준 변경
    const baseOffset = year === 2025 && month >= 9 ? -35 : -14;

    const startDate = firstMonday.add(weekIndex * 7 + baseOffset, 'day');
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
        ...['발', '찾', '합', '섭', '복', '예정'].reduce(
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
        const 인도자지역 = (s.인도자지역 ?? '').trim();
        const 인도자팀 = getTeamName(s.인도자팀);
        if (!REGIONS.includes(인도자지역 as Region) || !fixedTeams.includes(인도자팀)) return;

        if (mode === 'monthly') {
            ['발', '찾', '합', '섭', '복', '예정'].forEach((step) => {
                const key = step.toLowerCase() as keyof Student;
                const dateStr = s[key] as string | null | undefined;
                const date = dateStr ? dayjs(dateStr) : null;
                if (date && date.isValid() && date.year() === year && date.month() + 1 === selectedMonth) {
                    holdMap[`${인도자지역}-${인도자팀}-${step}`] =
                        (holdMap[`${인도자지역}-${인도자팀}-${step}`] ?? 0) + 1;
                }
            });
        }

        ['발', '찾', '합', '섭', '복', '예정'].forEach((step) => {
            const key = step.toLowerCase() as keyof Student;
            const dateStr = s[key] as string | null | undefined;
            if (!dateStr) return;

            const date = dayjs(dateStr);
            if (!date.isValid() || date.year() !== year) return;

            const mappedStep = step;

            const targets =
                step === '발' || step === '찾'
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

                        weeklyAchievements[지역] ??= {};
                        weeklyAchievements[지역][teamNumber] ??= {};
                        weeklyAchievements[지역][teamNumber][week] ??= {};
                        weeklyAchievements[지역][teamNumber][week][mappedStep] =
                            (weeklyAchievements[지역][teamNumber][week][mappedStep] ?? 0) + 점수;
                    });
                } else if (date.month() + 1 === selectedMonth) {
                    monthlyAchievements[지역] ??= {};
                    monthlyAchievements[지역][팀] ??= {};
                    monthlyAchievements[지역][팀][mappedStep] = (monthlyAchievements[지역][팀][mappedStep] ?? 0) + 점수;
                }
            });
        });
    });

    if (mode === 'monthly') {
        const tableData: TableRow[] = [];

        REGIONS.forEach((region) => {
            const teamsInRegion = fixedTeams.filter(
                (t) => monthlyAchievements[region] && monthlyAchievements[region][t]
            );
            teamsInRegion.forEach((team) => {
                const stepData = monthlyAchievements[region]?.[team] || {};
                const row: TableRow = {
                    key: `${region}-${team}`,
                    지역: region,
                    팀: team,
                    탈락: stepData['탈락'] ?? 0,
                    ...['발', '찾', '합', '섭', '복', '예정'].reduce(
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
            (Object.keys(row) as Array<keyof TableRow>).forEach((key) => {
                if (key !== 'key' && key !== '지역' && key !== '팀') {
                    monthlyTotalRow[key] = (Number(monthlyTotalRow[key]) || 0) + (Number(row[key]) || 0);
                }
            });
        });

        // DEBUG: 사용자 요청에 따라 모든 총합 값을 정수로 반올림 처리
        (Object.keys(monthlyTotalRow) as Array<keyof TableRow>).forEach((key) => {
            if (key !== 'key' && key !== '지역' && key !== '팀') {
                const value = monthlyTotalRow[key];
                if (typeof value === 'number') {
                    monthlyTotalRow[key] = Math.round(value);
                }
            }
        });

        return {
            weekly: weeklyAchievements,
            monthly: {
                achievements: tableData,
                totalRow: monthlyTotalRow,
            },
        };
    }

    return { weekly: weeklyAchievements };
};
