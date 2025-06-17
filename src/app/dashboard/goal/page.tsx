'use client';
import { useState, useEffect } from 'react';

// 타입 정의
interface WeeklyGoals {
    A: number;
    B: number;
    C: number;
    D: number;
    F: number;
}

interface WeeklyPercentages {
    week1: WeeklyGoals;
    week2: WeeklyGoals;
    week3: WeeklyGoals;
    week4: WeeklyGoals;
}

interface ConversionRates {
    aToB: number;
    bToC: number;
    cToD: number;
    dToF: number;
}

interface FGoals {
    team1: string;
    team2: string;
    team3: string;
    team4: string;
}

interface TeamResult {
    team: number;
    goals: WeeklyGoals;
    weeks: WeeklyGoals[];
}

interface Results {
    teams: TeamResult[];
    totals: WeeklyGoals;
}

// 초기 결과 계산
const initializeResults = (
    fGoals: FGoals,
    conversionRates: ConversionRates,
    weeklyPercentages: WeeklyPercentages
): Results => {
    console.log('initializeResults called with:', { fGoals, conversionRates, weeklyPercentages }); // 디버깅용
    const goals = [fGoals.team1, fGoals.team2, fGoals.team3, fGoals.team4].map((f) => parseFloat(f));

    // 각 팀의 목표 계산
    const teamResults: TeamResult[] = goals.map((fValue, index) => {
        const d = Math.ceil(fValue / conversionRates.dToF);
        const c = Math.ceil(d / conversionRates.cToD);
        const b = Math.ceil(c / conversionRates.bToC);
        const a = Math.ceil(b / conversionRates.aToB);

        // 주차별 목표 계산
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

    // 총합 계산
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

    console.log('initializeResults returning:', { teams: teamResults, totals }); // 디버깅용
    return { teams: teamResults, totals };
};

// 주차별 날짜 범위 계산 (이전 주의 월-일)
const getWeekDateRange = (month: number, weekIndex: number): string => {
    const year = 2025;
    // 해당 월의 첫 날
    const firstDay = new Date(year, month - 1, 1);
    // 첫 월요일 찾기
    const firstMonday = new Date(firstDay);
    firstMonday.setDate(firstDay.getDate() + ((8 - firstDay.getDay()) % 7 || 7));

    // 주차별 시작일 계산 (이전 주)
    const startDate = new Date(firstMonday);
    startDate.setDate(firstMonday.getDate() + weekIndex * 7 - 7);

    // 주차별 종료일 계산 (시작일 + 6일)
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    // 월이 넘어가는 경우 처리
    const startMonth = startDate.getMonth() + 1;
    const startDay = startDate.getDate();
    const endMonth = endDate.getMonth() + 1;
    const endDay = endDate.getDate();

    return `${startMonth}.${startDay}~${endMonth}.${endDay}`;
};

export default function GoalCalculatorTable() {
    // 기본 F 목표
    const defaultFGoals: FGoals = { team1: '4.5', team2: '4.5', team3: '4.0', team4: '3.0' };
    // 기본 단계향상률
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

    const [fGoals, setFGoals] = useState<FGoals>(defaultFGoals);
    const [conversionRates, setConversionRates] = useState<ConversionRates>(defaultConversionRates);
    const [weeklyPercentages, setWeeklyPercentages] = useState<WeeklyPercentages>(defaultWeeklyPercentages);
    const [results, setResults] = useState<Results>(
        initializeResults(defaultFGoals, defaultConversionRates, defaultWeeklyPercentages)
    );
    const [error, setError] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>('6'); // 기본값: 6월

    // results 상태 변화 디버깅
    useEffect(() => {
        console.log('results state updated:', results);
    }, [results]);

    // 목표 계산
    const calculateGoals = (
        currentFGoals: FGoals,
        currentConversionRates: ConversionRates,
        currentWeeklyPercentages: WeeklyPercentages
    ) => {
        console.log('calculateGoals called with:', { currentFGoals, currentConversionRates, currentWeeklyPercentages }); // 디버깅용
        const goals = [currentFGoals.team1, currentFGoals.team2, currentFGoals.team3, currentFGoals.team4].map(
            parseFloat
        );
        // F 목표 유효성 검사
        if (goals.some((f) => isNaN(f) || f <= 0)) {
            setError('모든 팀의 F 목표는 유효한 양수이어야 합니다.');
            return;
        }
        // 단계향상률 유효성 검사
        if (Object.values(currentConversionRates).some((rate) => isNaN(rate) || rate <= 0 || rate > 1)) {
            setError('모든 단계향상률은 1~100% 사이의 정수 백분율이어야 합니다.');
            return;
        }
        // 주차별 비율 유효성 검사
        const invalidWeek = Object.keys(currentWeeklyPercentages).find((week) =>
            Object.values(currentWeeklyPercentages[week as keyof WeeklyPercentages]).some((p) => isNaN(p) || p < 0)
        );
        if (invalidWeek) {
            setError('모든 주차의 비율은 0~100% 사이의 정수 백분율이어야 합니다.');
            return;
        }
        // 주차별 비율 합계 디버깅
        Object.keys(currentWeeklyPercentages).forEach((week) => {
            const total = Object.values(currentWeeklyPercentages[week as keyof WeeklyPercentages]).reduce(
                (sum: number, p: number) => sum + p,
                0
            );
            console.log(`Week ${week} percentage sum: ${total * 100}%`); // 디버깅용
        });

        // 새 결과 계산
        const newResults = initializeResults(currentFGoals, currentConversionRates, currentWeeklyPercentages);
        console.log('calculateGoals: Setting new results', newResults); // 디버깅용
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

    // F 목표 입력 변경 처리
    const handleFGoalChange = (team: keyof FGoals, value: string) => {
        console.log(`handleFGoalChange: ${team} = ${value}`); // 디버깅용
        setFGoals((prev: FGoals) => {
            const newFGoals = { ...prev, [team]: value };
            calculateGoals(newFGoals, conversionRates, weeklyPercentages);
            return newFGoals;
        });
    };

    // 단계향상률 입력 변경 처리
    const handleConversionRateChange = (key: keyof ConversionRates, value: string) => {
        console.log(`handleConversionRateChange: ${key} = ${value}`); // 디버깅용
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

    // 주차별 비율 입력 변경 처리
    const handleWeeklyPercentageChange = (week: keyof WeeklyPercentages, key: keyof WeeklyGoals, value: string) => {
        console.log(`handleWeeklyPercentageChange: ${week} ${key} = ${value}`); // 디버깅용
        const num = Number(value);
        if (isNaN(num) || num < 0 || num > 100 || !Number.isInteger(num)) {
            setError('비율은 0~100% 사이의 정수 백분율이어야 합니다.');
            return;
        }
        setWeeklyPercentages((prev: WeeklyPercentages) => {
            const currentWeek = { ...prev[week] };
            const newValue = num / 100;
            // 선택한 키에 값 설정
            currentWeek[key] = newValue;
            // 나머지 키를 0으로 설정 (100%인 경우)
            if (newValue === 1) {
                (['A', 'B', 'C', 'D', 'F'] as (keyof WeeklyGoals)[]).forEach((k) => {
                    if (k !== key) currentWeek[k] = 0;
                });
            }
            const newWeeklyPercentages = {
                ...prev,
                [week]: currentWeek,
            };
            console.log('New weeklyPercentages:', newWeeklyPercentages); // 디버깅용
            calculateGoals(fGoals, conversionRates, newWeeklyPercentages);
            return newWeeklyPercentages;
        });
        setError('');
    };

    // 월 선택 변경 처리
    const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        console.log(`handleMonthChange: selectedMonth = ${e.target.value}`); // 디버깅용
        setSelectedMonth(e.target.value);
    };

    // 렌더링 시 results 상태 확인
    console.log('Rendering with results:', results); // 디버깅용

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
            <h1 className="text-2xl font-bold mb-4 text-center">
                청년회 {selectedMonth}월 그룹 복음방 개강 4주 플랜 목표 설정
            </h1>
            <div className="mb-4">
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
            <div className="grid grid-cols-2 gap-4 mb-4">
                {(['team1', 'team2', 'team3', 'team4'] as (keyof FGoals)[]).map((team, index) => (
                    <div key={team}>
                        <label htmlFor={team} className="block text-sm font-medium text-gray-700">
                            노원 {index + 1}팀 F 목표:
                        </label>
                        <input
                            type="number"
                            id={team}
                            value={fGoals[team]}
                            onChange={(e) => handleFGoalChange(team, e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder={`e.g., ${[4.5, 4.5, 4.0, 3.0][index]}`}
                            step="0.1"
                        />
                    </div>
                ))}
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            <div className="mt-6">
                {/* 총 목표 테이블 */}
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
                                <td className="border p-2">노원 {team.team}팀</td>
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

                {/* 단계향상률 테이블 */}
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
                            {(['aToB', 'bToC', 'cToD', 'dToF'] as (keyof ConversionRates)[]).map((key) => (
                                <td key={key} className="border p-2 text-center">
                                    <input
                                        type="number"
                                        value={(conversionRates[key] * 100).toFixed(0)}
                                        onChange={(e) => handleConversionRateChange(key, e.target.value)}
                                        className="w-16 px-2 py-1 border rounded-md text-center"
                                        step="1"
                                        min="1"
                                        max="100"
                                    />
                                    %
                                </td>
                            ))}
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
                                                weeklyPercentages[week as keyof WeeklyPercentages][key] * 100
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

                {/* 주차별 목표 테이블 */}
                <h2 className="text-lg font-semibold mb-2">{selectedMonth}월 개강 목표</h2>
                {(['week1', 'week2', 'week3', 'week4'] as (keyof WeeklyPercentages)[]).map((week, weekIndex) => (
                    <div key={week} className="mb-6">
                        <h3 className="text-md font-medium mb-2">
                            {weekIndex + 1}주차 ({getWeekDateRange(parseInt(selectedMonth), weekIndex)})
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
                                    return (
                                        <tr key={team.team}>
                                            <td className="border p-2">노원 {team.team}팀</td>
                                            <td className="border p-2 text-center">{team.weeks[weekIndex].A}</td>
                                            <td className="border p-2 text-center">0</td>
                                            <td className="border p-2 text-center">0.00%</td>
                                            <td className="border p-2 text-center">{team.weeks[weekIndex].B}</td>
                                            <td className="border p-2 text-center">0</td>
                                            <td className="border p-2 text-center">0.00%</td>
                                            <td className="border p-2 text-center">{team.weeks[weekIndex].C}</td>
                                            <td className="border p-2 text-center">0</td>
                                            <td className="border p-2 text-center">0.00%</td>
                                            <td className="border p-2 text-center">{team.weeks[weekIndex].D}</td>
                                            <td className="border p-2 text-center">0</td>
                                            <td className="border p-2 text-center">0.00%</td>
                                            <td className="border p-2 text-center">{team.weeks[weekIndex].F}</td>
                                            <td className="border p-2 text-center">0</td>
                                            <td className="border p-2 text-center">0.00%</td>
                                        </tr>
                                    );
                                })}
                                <tr className="font-bold">
                                    <td className="border p-2">계</td>
                                    <td className="border p-2 text-center">
                                        {results.teams.reduce(
                                            (sum: number, team: TeamResult) => sum + team.weeks[weekIndex].A,
                                            0
                                        )}
                                    </td>
                                    <td className="border p-2 text-center">0</td>
                                    <td className="border p-2 text-center">0.00%</td>
                                    <td className="border p-2 text-center">
                                        {results.teams.reduce(
                                            (sum: number, team: TeamResult) => sum + team.weeks[weekIndex].B,
                                            0
                                        )}
                                    </td>
                                    <td className="border p-2 text-center">0</td>
                                    <td className="border p-2 text-center">0.00%</td>
                                    <td className="border p-2 text-center">
                                        {results.teams.reduce(
                                            (sum: number, team: TeamResult) => sum + team.weeks[weekIndex].C,
                                            0
                                        )}
                                    </td>
                                    <td className="border p-2 text-center">0</td>
                                    <td className="border p-2 text-center">0.00%</td>
                                    <td className="border p-2 text-center">
                                        {results.teams.reduce(
                                            (sum: number, team: TeamResult) => sum + team.weeks[weekIndex].D,
                                            0
                                        )}
                                    </td>
                                    <td className="border p-2 text-center">0</td>
                                    <td className="border p-2 text-center">0.00%</td>
                                    <td className="border p-2 text-center">
                                        {results.teams.reduce(
                                            (sum: number, team: TeamResult) => sum + team.weeks[weekIndex].F,
                                            0
                                        )}
                                    </td>
                                    <td className="border p-2 text-center">0</td>
                                    <td className="border p-2 text-center">0.00%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>
        </div>
    );
}
