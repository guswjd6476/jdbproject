import {
    ConversionRates,
    예정Goals,
    fixedTeams,
    Region,
    REGIONS,
    Results,
    Student,
    TableRow,
    TeamResult,
    WeeklyGoals,
    WeeklyPercentages,
} from './types';
import dayjs, { Dayjs } from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import isoWeek from 'dayjs/plugin/isoWeek';
import { Students } from '../hook/useStudentsQuery';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);
dayjs.extend(isBetween);
dayjs.extend(isoWeek);
function normalizeBirth(value: string): string {
    if (!value) return '';

    const digits = value.replace(/\D/g, '');

    // YYMMDD → 19YY-MM-DD
    if (digits.length === 6) {
        return `19${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
    }

    // YYYYMMDD → YYYY-MM-DD
    if (digits.length === 8) {
        return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    }

    return value;
}

/**
 * dayjs 안전 파싱
 */
export function parseDateSafe(value: any) {
    if (!value) return null;

    // 이미 Date 객체면 바로 처리
    if (value instanceof Date) {
        const d = dayjs(value);
        return d.isValid() ? d : null;
    }

    const v = String(value).trim();

    // 1️⃣ ISO 문자열 (Z 포함) — 최우선
    if (v.includes('T')) {
        const d = dayjs(v);
        if (d.isValid()) return d;
    }

    const formats = [
        // 날짜만
        'YYYY-MM-DD',
        'YYYY-M-D',
        'YYYY/MM/DD',
        'YYYY.M.D',
        'YYYYMMDD',

        // 날짜 + 시간
        'YYYY-MM-DD HH:mm',
        'YYYY-MM-DD HH:mm:ss',
        'YYYY/MM/DD HH:mm:ss',
        'YYYY.MM.DD HH:mm:ss',

        // YY 기반
        'YYMMDD',
        'YY.MM.DD',
        'YY/MM/DD',
    ];

    for (const f of formats) {
        const d = dayjs(v, f, true);
        if (d.isValid()) return d;
    }

    // 2️⃣ 숫자만 있는 경우 (예: "50102")
    const digits = v.replace(/\D/g, '');

    // YYYYMMDD
    if (digits.length === 8) {
        const d = dayjs(digits, 'YYYYMMDD', true);
        if (d.isValid()) return d;
    }

    // YYMMDD → 19YY 기준
    if (digits.length === 6) {
        const d = dayjs(`19${digits}`, 'YYYYMMDD', true);
        if (d.isValid()) return d;
    }

    return null;
}
// export const getWeekDateRange = (month: number, year: number, weekIndex: number) => {
//     // 1월이면: 전년도 12월 5주차부터 이어지는 구조
//     if (month === 1) {
//         const prevYear = year - 1;

//         // 12월 주차 1~8주 계산 (기존 알고리즘 사용)
//         const decemberWeeks = [];
//         for (let i = 0; i < 8; i++) {
//             decemberWeeks.push(computeWeek(prevYear, 12, i));
//         }

//         // 1월 1주차 = 12월 5주차
//         const sourceIndex = 4 + weekIndex;

//         // 12월의 이어지는 주차가 있으면 그대로 사용
//         if (sourceIndex < decemberWeeks.length) {
//             return decemberWeeks[sourceIndex];
//         }

//         // 넘어가면 1월 자체 주차 계산
//         return computeWeek(year, 1, sourceIndex - decemberWeeks.length);
//     }

//     // 1월 외에는 기존 방식
//     return computeWeek(year, month, weekIndex);
// };
export const getWeekDateRange = (year: number, month: number, weekIndex: number) => {
    // 1️⃣ 해당 월 1일
    const firstDay = dayjs(new Date(year, month - 1, 1));

    // 2️⃣ 해당 월 기준 첫 번째 월요일
    const dayOfWeek = firstDay.day(); // 0=일, 1=월 ...
    const diffToMonday = dayOfWeek === 1 ? 0 : (8 - dayOfWeek) % 7;
    const firstMonday = firstDay.add(diffToMonday, 'day');

    // 3️⃣ 정책 주차 보정 (기존 로직 그대로)
    const baseOffsetDays =
        year === 2025 && month === 12 ? -28 : year === 2025 && month >= 9 ? -35 : year >= 2026 ? -35 : -14;

    // 4️⃣ 주차 계산
    const start = firstMonday.add(weekIndex * 7 + baseOffsetDays, 'day');
    const end = start.add(6, 'day');

    return {
        start,
        end,
        display: `${start.format('M.D')}~${end.format('M.D')}`,
    };
};

function computeWeek(year: number, month: number, weekIndex: number) {
    const firstDay = dayjs(new Date(year, month - 1, 1));
    const firstMonday = firstDay.add((8 - firstDay.day()) % 7 || 7, 'day');

    const baseOffset = year === 2025 && month >= 9 ? -35 : year >= 2026 ? -35 : -14;

    const start = firstMonday.add(weekIndex * 7 + baseOffset, 'day');
    const end = start.add(6, 'day');

    return {
        start,
        end,
        display: `${start.format('M.D')}~${end.format('M.D')}`,
    };
}

export const getTeamName = (team?: string | null): string => {
    if (!team) return '기타팀';
    const prefix = team.split('-')[0];
    return fixedTeams.find((t) => t.startsWith(prefix)) ?? '기타팀';
};
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

        const weeks = ['week1', 'week2', 'week3', 'week4', 'week5', 'week6', 'week7', 'week8'].map((week) => {
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

        return {
            team: String(index + 1), // ⭐ FIXED
            goals: { 발, 찾, 합, 섭, 복, 예정: 예정Value },
            weeks,
        };
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
                const date = dateStr ? parseDateSafe(dateStr) : null;
                if (date && date.year() === year && date.month() + 1 === selectedMonth) {
                    holdMap[`${인도자지역}-${인도자팀}-${step}`] =
                        (holdMap[`${인도자지역}-${인도자팀}-${step}`] ?? 0) + 1;
                }
            });
        }

        ['발', '찾', '합', '섭', '복', '예정'].forEach((step) => {
            const key = step.toLowerCase() as keyof Student;
            const dateStr = s[key] as string | null | undefined;
            if (!dateStr) return;

            const date = parseDateSafe(dateStr);
            if (!date || date.year() !== year) return;

            let targets: { 지역: string; 팀: string; 점수: number }[] = [];

            if (['발', '찾', '합'].includes(step)) {
                targets = [
                    {
                        지역: (s.인도자지역 ?? '').trim(),
                        팀: getTeamName(s.인도자팀),
                        점수: 1,
                    },
                ];
            } else {
                targets = [
                    {
                        지역: (s.교사지역 ?? '').trim(),
                        팀: getTeamName(s.교사팀),
                        점수: 1,
                    },
                ];
            }

            targets.forEach(({ 지역, 팀, 점수 }) => {
                if (!REGIONS.includes(지역 as Region) || !fixedTeams.includes(팀)) return;
                const teamNumber = 팀.match(/\d+/)?.[0] || 팀;

                if (mode === 'weekly') {
                    Array.from({ length: 8 }, (_, index) => `week${index + 1}`).forEach((week, index) => {
                        const { start, end } = getWeekDateRange(year, selectedMonth, index); // ✅ 인자 순서 FIX
                        if (!date.isBetween(start, end, 'day', '[]')) return;

                        weeklyAchievements[지역] ??= {};
                        weeklyAchievements[지역][teamNumber] ??= {};
                        weeklyAchievements[지역][teamNumber][week] ??= {};
                        weeklyAchievements[지역][teamNumber][week][step] =
                            (weeklyAchievements[지역][teamNumber][week][step] ?? 0) + 점수;
                    });
                } else if (date.month() + 1 === selectedMonth) {
                    monthlyAchievements[지역] ??= {};
                    monthlyAchievements[지역][팀] ??= {};
                    monthlyAchievements[지역][팀][step] = (monthlyAchievements[지역][팀][step] ?? 0) + 점수;
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
