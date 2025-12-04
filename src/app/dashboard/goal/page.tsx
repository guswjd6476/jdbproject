'use client';

import * as React from 'react';
import {
    예정Goals,
    Results,
    TeamResult,
    WeeklyGoals,
    WeeklyPercentages,
    REGIONS,
    DEFAULT_예정_goals,
    Region,
    Student,
    fixedTeams,
    STEPS2,
} from '@/app/lib/types';
import { useState, useEffect, useMemo, useCallback } from 'react';
import dayjs from 'dayjs';
import { Students, useStudentsQuery } from '@/app/hook/useStudentsQuery';
import isBetween from 'dayjs/plugin/isBetween';
import { getTeamName, getWeekDateRange } from '@/app/lib/function';
import html2canvas from 'html2canvas';
import { Button, Table, Spin, Radio } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useUser } from '@/app/hook/useUser';

dayjs.extend(isBetween);
const multiplierSteps = ['발', '찾', '합', '섭', '복'] as const;
/* -----------------------------------------------------------
    12월 cross-year 보정된 주차 계산 함수
----------------------------------------------------------- */

/* -----------------------------------------------------------
    기본 목표 배수
----------------------------------------------------------- */
const DEFAULT_GOAL_MULTIPLIERS = {
    발: 20,
    찾: 10,
    합: 4,
    섭: 2,
    복: 1.5,
};

/* -----------------------------------------------------------
    강조할 주차별 단계 설정
----------------------------------------------------------- */
const WEEK_HIGHLIGHT: Record<number, string[]> = {
    0: ['발'],
    1: ['찾'],
    2: ['합'],
    3: ['섭'],
    4: ['섭'],
    5: ['복'],
    6: ['복', '예정'],
    7: ['예정'],
};

/* -----------------------------------------------------------
    단계 배열 및 타입
----------------------------------------------------------- */
const steps = ['발', '찾', '합', '섭', '복', '예정'] as const;
type Step = (typeof steps)[number];

/* -----------------------------------------------------------
    월별 주차 수 계산
----------------------------------------------------------- */
const getWeekCount = (year: number, month: string): number => {
    const m = Number(month);

    if (year < 2025) return 5;
    if (year === 2025 && m <= 8) return 5;

    return 8;
};
/**********************************************
 * PART 2 — WeeklyGoalsTable 컴포넌트
 **********************************************/
const WeeklyGoalsTable: React.FC<{
    data: { region: string; results: Results }[];
    achievements: Record<string, Record<string, Record<string, Record<Step, number>>>>;
    selectedMonth: string;
    selectedYear: number;
    year: number;
}> = ({ data, achievements, selectedMonth, selectedYear, year }) => {
    const weekCount = getWeekCount(selectedYear, selectedMonth);

    const weekNames =
        weekCount === 5
            ? ['발집주', '발집주', '상따주', '복따주', '센띄주']
            : ['발집주', '발집주', '육따주', '상담주', '영따주', '복음방주', '복음방주', '센띄,그룹복'];

    const weeks = Array.from({ length: weekCount }, (_, i) => ({
        weekNumber: i + 1,
        weekKey: `week${i + 1}`,
        label: `${i + 1}주차 (${weekNames[i]})`,
    }));

    /* 주차별 캡처 Reference */
    const tableRefs = useMemo(() => {
        const map: Record<string, React.RefObject<HTMLDivElement | null>> = {};
        weeks.forEach(({ weekKey }) => {
            map[weekKey] = React.createRef<HTMLDivElement>();
        });
        return map;
    }, [weekCount]);

    /* 이미지 저장 기능 */
    const saveTableAsImage = useCallback(
        async (weekKey: string, weekIndex: number) => {
            const container = tableRefs[weekKey]?.current;
            if (!container) return;

            const canvas = await html2canvas(container, {
                scale: 2,
                backgroundColor: '#ffffff',
            });

            const link = document.createElement('a');
            link.download = `${selectedYear}년_${selectedMonth}월_${weekIndex + 1}주차.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        },
        [tableRefs, selectedMonth, selectedYear]
    );

    /* 달성률 시각화 색상 */
    const getRateStyle = (rate: number, highlight: boolean): React.CSSProperties => {
        if (rate === 0) return highlight ? { backgroundColor: '#e0f2fe' } : {};

        let color = '';

        if (rate >= 120) color = '#b7eb8f';
        else if (rate >= 100) color = '#d9f7be';
        else if (rate >= 80) color = '#fff566';
        else if (rate >= 60) color = '#ffd591';
        else color = '#ffa39e';

        return {
            backgroundColor: color,
            fontWeight: highlight ? 'bold' : 'normal',
        };
    };

    return (
        <>
            {weeks.map(({ weekKey, weekNumber, label }) => {
                const highlight = WEEK_HIGHLIGHT[weekNumber - 1] || [];

                /* 테이블 데이터 변환 */
                const rows = data.flatMap(({ region, results }) =>
                    results.teams.map((team) => {
                        const teamKey = team.team;
                        const ach = achievements[region]?.[teamKey]?.[weekKey] || {};

                        const record: any = {
                            key: `${region}-${teamKey}`,
                            team: `${region} ${teamKey}팀`,
                        };

                        steps.forEach((step) => {
                            const goal = team.weeks[weekNumber - 1][step];
                            const done = ach?.[step] ?? 0;
                            const rate = goal > 0 ? (done / goal) * 100 : 0;

                            record[`${step}-goal`] = goal;
                            record[`${step}-ach`] = done;
                            record[`${step}-rate`] = {
                                text: goal > 0 ? `${rate.toFixed(1)}%` : '-',
                                style: getRateStyle(rate, highlight.includes(step)),
                            };
                        });

                        return record;
                    })
                );

                /* 테이블 컬럼 */
                const columns: ColumnsType<any> = [
                    {
                        title: '순위',
                        dataIndex: 'no',
                        width: 60,
                        align: 'center' as const, // 🔧 align 타입 수정
                        render: (_: any, __: any, index: number) => index + 1,
                    },
                    {
                        title: '팀',
                        dataIndex: 'team',
                        align: 'center' as const, // 🔧 align 타입 수정
                        width: 150,
                    },
                    ...steps.flatMap((step) => [
                        {
                            title: `${step} 목표`,
                            dataIndex: `${step}-goal`,
                            align: 'center' as const, // 🔧 align 타입 수정
                        },
                        {
                            title: `${step} 달성`,
                            dataIndex: `${step}-ach`,
                            align: 'center' as const,
                        },
                        {
                            title: `${step} 달성률`,
                            dataIndex: `${step}-rate`,
                            align: 'center' as const,
                            render: (
                                v: { text: string; style: React.CSSProperties } // 🔧 v 타입 지정
                            ) => <div style={{ padding: 4, borderRadius: 4, ...v.style }}>{v.text}</div>,
                        },
                    ]),
                ];

                /* 주차 날짜 표시 */
                const { display } = getWeekDateRange(Number(selectedMonth), year, weekNumber - 1);

                return (
                    <div
                        key={weekKey}
                        className="mb-10"
                    >
                        <h3 className="font-semibold mb-2">
                            {selectedYear}년 {selectedMonth}월 {label} ({display})
                        </h3>

                        <div
                            ref={tableRefs[weekKey]}
                            className="bg-white p-4 rounded shadow-md"
                        >
                            <Table
                                columns={columns}
                                dataSource={rows}
                                pagination={false}
                                bordered
                                size="small"
                                scroll={{ x: 'max-content' }}
                            />
                        </div>

                        <Button
                            type="primary"
                            className="mt-2"
                            onClick={() => saveTableAsImage(weekKey, weekNumber - 1)}
                        >
                            이미지 저장
                        </Button>
                    </div>
                );
            })}
        </>
    );
};
/**********************************************
 * PART 3 — GoalCalculatorTable 메인 UI
 **********************************************/
export default function GoalCalculatorTable() {
    const { region: userRegion, isAdmin, isLoading: isUserLoading, error: userError, role } = useUser();
    const { data: students = [], isLoading: isStudentsLoading } = useStudentsQuery();

    /* 🔥 년도 선택 (현재 기준 전년도 / 올해 / 다음해) */
    const currentYear = dayjs().year();
    const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [selectedMonth, setSelectedMonth] = useState<string>(String(dayjs().month() + 1));

    /* 기본 주차 비율 */
    const defaultWeeklyPercentages = useMemo(
        () => ({
            week1: { 발: 0.7, 찾: 0.3, 합: 0, 섭: 0.0, 복: 0.0, 예정: 0.0 },
            week2: { 발: 0.3, 찾: 0.7, 합: 0.3, 섭: 0, 복: 0.0, 예정: 0.0 },
            week3: { 발: 0.0, 찾: 0.0, 합: 0.7, 섭: 0, 복: 0.0, 예정: 0.0 },
            week4: { 발: 0.0, 찾: 0.0, 합: 0, 섭: 0.5, 복: 0.0, 예정: 0.0 },
            week5: { 발: 0.0, 찾: 0.0, 합: 0, 섭: 0.5, 복: 0.0, 예정: 0.0 },
            week6: { 발: 0.0, 찾: 0.0, 합: 0, 섭: 0.0, 복: 0.5, 예정: 0.0 },
            week7: { 발: 0.0, 찾: 0.0, 합: 0, 섭: 0.0, 복: 0.5, 예정: 0.5 },
            week8: { 발: 0.0, 찾: 0.0, 합: 0, 섭: 0.0, 복: 0.0, 예정: 0.5 },
        }),
        []
    );

    const [goalMultipliers, setGoalMultipliers] = useState(DEFAULT_GOAL_MULTIPLIERS);
    const [region, setRegion] = useState<Region | null>(null);
    const [fGoals, setFGoals] = useState<예정Goals | null>(null);
    const [weeklyPercentages, setWeeklyPercentages] = useState<WeeklyPercentages>(defaultWeeklyPercentages);
    const [results, setResults] = useState<Results | null>(null);

    const [error, setError] = useState('');
    const [apiError, setApiError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const [allRegionsResults, setAllRegionsResults] = useState<{ region: Region; results: Results }[]>([]);
    const [viewMode, setViewMode] = useState<'region' | 'month'>('region');

    /* 성취도 계산 */
    const weeklyAchievements = useMemo(
        () => calculateWeeklyAchievements(students, Number(selectedMonth), selectedYear, viewMode),
        [students, selectedMonth, selectedYear, viewMode]
    );
    /**********************************************
     * 사용자 기본 지역 세팅
     **********************************************/
    useEffect(() => {
        if (!isUserLoading && userRegion) {
            const initialRegion: Region = userRegion === 'all' ? '도봉' : (userRegion as Region);
            setRegion(initialRegion);

            const baseGoals = DEFAULT_예정_goals[initialRegion];
            setFGoals(baseGoals);

            const res = initializeResults(baseGoals, defaultWeeklyPercentages, goalMultipliers);
            setResults(res);
        }
    }, [isUserLoading, userRegion]);

    /**********************************************
     * 지역별 설정 fetch
     **********************************************/
    useEffect(() => {
        if (!region) return;

        const fetchConfig = async () => {
            try {
                const res = await fetch(`/api/goal?region=${region}&month=${selectedMonth}&year=${selectedYear}`);
                const json = await res.json();

                const loadedGoals = json.data?.예정_goals ?? DEFAULT_예정_goals[region];
                const loadedWeekly = json.data?.weekly_percentages ?? defaultWeeklyPercentages;
                const loadedMultiplier = json.data?.conversion_rates ?? DEFAULT_GOAL_MULTIPLIERS;

                setFGoals(loadedGoals);
                setWeeklyPercentages(loadedWeekly);
                setGoalMultipliers(loadedMultiplier);

                const newResults = initializeResults(loadedGoals, loadedWeekly, loadedMultiplier);
                setResults(newResults);
            } catch {
                setApiError('서버 설정을 불러오지 못했습니다.');
            }
        };

        if (viewMode === 'region') fetchConfig();
    }, [region, selectedMonth, selectedYear, viewMode]);

    /**********************************************
     * 전체 지역 계산 (월별 보기)
     **********************************************/
    useEffect(() => {
        const fetchAll = async () => {
            const result = await Promise.all(
                REGIONS.map(async (reg) => {
                    try {
                        const res = await fetch(`/api/goal?region=${reg}&month=${selectedMonth}&year=${selectedYear}`);
                        const json = await res.json();

                        const goals = json.data?.예정_goals ?? DEFAULT_예정_goals[reg];
                        const weekly = json.data?.weekly_percentages ?? defaultWeeklyPercentages;

                        return {
                            region: reg,
                            results: initializeResults(goals, weekly, goalMultipliers),
                        };
                    } catch {
                        return {
                            region: reg,
                            results: initializeResults(
                                DEFAULT_예정_goals[reg],
                                defaultWeeklyPercentages,
                                goalMultipliers
                            ),
                        };
                    }
                })
            );

            setAllRegionsResults(result);
        };

        if (viewMode === 'month') fetchAll();
        else if (viewMode === 'region' && region && results) {
            setAllRegionsResults([{ region, results }]);
        }
    }, [viewMode, region, results, selectedMonth, selectedYear]);

    /**********************************************
     * 설정 저장
     **********************************************/
    const saveConfig = useCallback(async () => {
        if (!isAdmin) return setApiError('수정 권한이 없습니다.');
        if (!region || !fGoals) return setApiError('지역 설정이 비어있습니다.');

        try {
            const res = await fetch('/api/goal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    region,
                    month: Number(selectedMonth),
                    year: selectedYear,
                    fGoals,
                    weeklyPercentages,
                    goalMultipliers,
                }),
            });

            const json = await res.json();
            if (!json.success) return setApiError(json.error ?? '저장 실패');

            setSuccessMessage('저장 완료');
            setTimeout(() => setSuccessMessage(''), 2000);
        } catch {
            setApiError('저장 중 오류 발생');
        }
    }, [region, selectedMonth, selectedYear, fGoals, weeklyPercentages, goalMultipliers]);

    /**********************************************
     * 입력 핸들러
     **********************************************/
    const handleInputChange = useCallback(
        (
            type: 'fGoal' | 'weeklyPercentage' | 'multiplier',
            key: keyof WeeklyGoals | string,
            value: string,
            week?: keyof WeeklyPercentages
        ) => {
            if (!fGoals) return;

            let newF = { ...fGoals };
            let newW = { ...weeklyPercentages };
            let newM = { ...goalMultipliers };

            if (type === 'fGoal') {
                newF[key] = value;
                setFGoals(newF);
            } else if (type === 'weeklyPercentage' && week) {
                newW[week] = { ...newW[week], [key]: Number(value) / 100 };
                setWeeklyPercentages(newW);
            } else if (type === 'multiplier') {
                newM[key as keyof typeof newM] = Number(value);
                setGoalMultipliers(newM);
            }

            setResults(initializeResults(newF, newW, newM));
        },
        [fGoals, weeklyPercentages, goalMultipliers]
    );

    /**********************************************
     * 지역 및 월/년 변경
     **********************************************/
    const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => setRegion(e.target.value as Region);

    const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedMonth(e.target.value);

    const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedYear(Number(e.target.value));

    /**********************************************
     * 로딩/에러 처리
     **********************************************/
    if (isUserLoading || isStudentsLoading || !region || !fGoals || !results) {
        return (
            <div className="flex justify-center items-center h-[80vh]">
                <Spin
                    size="large"
                    tip="로딩 중..."
                />
            </div>
        );
    }

    if (userError) return <p className="text-red-600 text-center mt-10">{userError}</p>;
    /**********************************************
     * 화면 렌더링
     **********************************************/
    const weekCount = getWeekCount(selectedYear, selectedMonth);
    const weeks = Array.from({ length: weekCount }, (_, i) => ({
        weekKey: `week${i + 1}`,
        label: `${i + 1}주차`,
    }));

    return (
        <div className="w-full mx-auto p-6">
            <h1 className="text-2xl font-bold mb-4 text-center">
                청년회 {selectedYear}년 {selectedMonth}월 달성 점검
            </h1>

            {/* 🔥 보기 모드 전환 */}
            <div className="flex justify-center mb-6">
                <Radio.Group
                    value={viewMode}
                    onChange={(e) => setViewMode(e.target.value)}
                    optionType="button"
                    buttonStyle="solid"
                >
                    <Radio.Button value="region">지역별 보기</Radio.Button>
                    <Radio.Button value="month">월별 보기</Radio.Button>
                </Radio.Group>
            </div>

            {/* -----------------------------------------
                🔥 지역별 보기 화면
            ------------------------------------------ */}
            {viewMode === 'region' ? (
                <>
                    {/* 년 / 월 / 지역 선택 */}
                    <div className="grid grid-cols-3 gap-4 mb-6 max-w-2xl mx-auto">
                        <div>
                            <label className="block mb-1 font-medium">년도 선택</label>
                            <select
                                value={selectedYear}
                                onChange={handleYearChange}
                                className="border rounded px-3 py-2 w-full"
                            >
                                {yearOptions.map((y) => (
                                    <option
                                        key={y}
                                        value={y}
                                    >
                                        {y}년
                                    </option>
                                ))}
                            </select>
                        </div>

                        {userRegion === 'all' && (
                            <div>
                                <label className="block mb-1 font-medium">지역 선택</label>
                                <select
                                    value={region}
                                    onChange={handleRegionChange}
                                    className="border rounded px-3 py-2 w-full"
                                >
                                    {REGIONS.map((r) => (
                                        <option
                                            key={r}
                                            value={r}
                                        >
                                            {r}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="block mb-1 font-medium">월 선택</label>
                            <select
                                value={selectedMonth}
                                onChange={handleMonthChange}
                                className="border rounded px-3 py-2 w-full"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                    <option
                                        key={m}
                                        value={m}
                                    >
                                        {m}월
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 🔥 팀별 F 목표 입력 */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        {Object.keys(fGoals).map((teamKey, idx) => (
                            <div key={teamKey}>
                                <label className="block mb-1 font-medium">
                                    {region} {idx + 1}팀 F 목표
                                </label>
                                <input
                                    type="number"
                                    value={fGoals[teamKey]}
                                    onChange={(e) => handleInputChange('fGoal', teamKey, e.target.value)}
                                    className="border rounded px-3 py-2 w-full"
                                    disabled={!isAdmin}
                                />
                            </div>
                        ))}
                    </div>

                    {/* 🔥 배수 입력 */}
                    <h3 className="font-semibold mt-6 mb-2">단계별 목표 배수 설정</h3>
                    <div className="grid grid-cols-5 gap-4 mb-6 p-4 border rounded">
                        {multiplierSteps.map((step) => (
                            <div key={step}>
                                <label className="block mb-1">{step} 배수</label>
                                <input
                                    type="number"
                                    value={goalMultipliers[step]}
                                    onChange={(e) => handleInputChange('multiplier', step, e.target.value)}
                                    className="border rounded px-3 py-2 w-full"
                                    disabled={role !== 'superAdmin'}
                                />
                            </div>
                        ))}
                    </div>

                    {/* 🔥 개강 대비 목표 종합 테이블 */}
                    <h2 className="text-lg font-semibold mb-2">개강대비 목표 종합</h2>

                    <table className="w-full border-collapse mb-6">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border p-2">팀</th>
                                <th className="border p-2">발</th>
                                <th className="border p-2">찾</th>
                                <th className="border p-2">합</th>
                                <th className="border p-2">섭</th>
                                <th className="border p-2">복</th>
                                <th className="border p-2">예정</th>
                            </tr>
                        </thead>

                        <tbody>
                            {results.teams.map((team, idx) => (
                                <tr key={team.team}>
                                    <td className="border p-2">
                                        {region} {idx + 1}팀
                                    </td>
                                    <td className="border p-2 text-center">{team.goals.발}</td>
                                    <td className="border p-2 text-center">{team.goals.찾}</td>
                                    <td className="border p-2 text-center">{team.goals.합}</td>
                                    <td className="border p-2 text-center">{team.goals.섭}</td>
                                    <td className="border p-2 text-center">{team.goals.복}</td>
                                    <td className="border p-2 text-center">{team.goals.예정}</td>
                                </tr>
                            ))}

                            {/* 총계 */}
                            <tr className="font-bold">
                                <td className="border p-2">계</td>
                                <td className="border p-2 text-center">{results.totals.발}</td>
                                <td className="border p-2 text-center">{results.totals.찾}</td>
                                <td className="border p-2 text-center">{results.totals.합}</td>
                                <td className="border p-2 text-center">{results.totals.섭}</td>
                                <td className="border p-2 text-center">{results.totals.복}</td>
                                <td className="border p-2 text-center">{results.totals.예정}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* 🔥 주차별 비율 설정 */}
                    <h2 className="text-lg font-semibold mb-2">주차별 비율 설정</h2>

                    <table className="w-full border-collapse mb-6">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border p-2">주차</th>
                                {steps.map((s) => (
                                    <th
                                        key={s}
                                        className="border p-2"
                                    >
                                        {s}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody>
                            {weeks.map(({ weekKey, label }) => (
                                <tr key={weekKey}>
                                    <td className="border p-2">{label}</td>

                                    {steps.map((step) => (
                                        <td
                                            key={step}
                                            className="border p-2 text-center"
                                        >
                                            <input
                                                type="number"
                                                value={(weeklyPercentages[weekKey]?.[step] ?? 0) * 100}
                                                onChange={(e) =>
                                                    handleInputChange('weeklyPercentage', step, e.target.value, weekKey)
                                                }
                                                className="w-16 px-2 py-1 border rounded-md text-center"
                                                disabled={!isAdmin}
                                            />
                                            %
                                        </td>
                                    ))}
                                </tr>
                            ))}

                            {/* 총합 */}
                            <tr className="font-bold">
                                <td className="border p-2">총합</td>
                                {steps.map((step) => {
                                    const total = weeks.reduce(
                                        (sum, { weekKey }) => sum + (weeklyPercentages[weekKey]?.[step] ?? 0),
                                        0
                                    );
                                    return (
                                        <td
                                            key={step}
                                            className="border p-2 text-center"
                                        >
                                            {Math.round(total * 100)}%
                                        </td>
                                    );
                                })}
                            </tr>
                        </tbody>
                    </table>

                    {/* 저장 버튼 */}
                    {isAdmin && (
                        <div className="flex justify-center mb-4">
                            <button
                                onClick={saveConfig}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                            >
                                저장
                            </button>
                        </div>
                    )}

                    {apiError && <p className="text-red-600 text-center">{apiError}</p>}
                    {successMessage && <p className="text-green-600 text-center">{successMessage}</p>}

                    {/* 🔥 지역별 주간 성취도 테이블 */}
                    <h2 className="text-lg font-semibold mb-2">
                        {selectedYear}년 {selectedMonth}월 {region} 개강 목표 대비 주간 성취도
                    </h2>

                    <WeeklyGoalsTable
                        data={[{ region, results }]}
                        achievements={weeklyAchievements}
                        selectedMonth={selectedMonth}
                        selectedYear={selectedYear}
                        year={selectedYear}
                    />
                </>
            ) : (
                /* -----------------------------------------
                   🔥 월별 보기 (전체 지역 비교)
                ------------------------------------------ */
                <>
                    <h2 className="text-lg font-semibold mb-4 text-center">
                        {selectedYear}년 {selectedMonth}월 전체 지역 주간 목표 / 달성 비교
                    </h2>

                    {/* 월 선택 */}
                    <div className="grid grid-cols-2 gap-4 mb-6 max-w-xl mx-auto">
                        <div>
                            <label className="block mb-1 font-medium">년도 선택</label>
                            <select
                                value={selectedYear}
                                onChange={handleYearChange}
                                className="border rounded px-3 py-2 w-full"
                            >
                                {yearOptions.map((y) => (
                                    <option
                                        key={y}
                                        value={y}
                                    >
                                        {y}년
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block mb-1 font-medium">월 선택</label>
                            <select
                                value={selectedMonth}
                                onChange={handleMonthChange}
                                className="border rounded px-3 py-2 w-full"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                    <option
                                        key={m}
                                        value={m}
                                    >
                                        {m}월
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <WeeklyGoalsTable
                        data={allRegionsResults}
                        achievements={weeklyAchievements}
                        selectedMonth={selectedMonth}
                        selectedYear={selectedYear}
                        year={selectedYear}
                    />
                </>
            )}
        </div>
    );
}
/**********************************************
 * PART 4 — initializeResults (목표 계산)
 **********************************************/
const initializeResults = (
    예정Goals: 예정Goals,
    weeklyPercentages: WeeklyPercentages,
    multipliers: { 발: number; 찾: number; 합: number; 섭: number; 복: number }
): Results => {
    const goalEntries = Object.entries(예정Goals);

    const teamResults: TeamResult[] = goalEntries.map(([teamKey, value]) => {
        const base = Number(value) || 0;
        const teamNum = teamKey.match(/\d+/)?.[0] ?? teamKey;

        // ① 단계별 전체 목표 계산
        const 발 = Math.ceil(base * multipliers.발);
        const 찾 = Math.ceil(base * multipliers.찾);
        const 합 = Math.ceil(base * multipliers.합);
        const 섭 = Math.ceil(base * multipliers.섭);
        const 복 = Math.ceil(base * multipliers.복);

        // ② 주차별 목표 계산
        const weeks = Array.from({ length: 8 }).map((_, idx) => {
            const wk = weeklyPercentages[`week${idx + 1}` as keyof WeeklyPercentages] ?? {
                발: 0,
                찾: 0,
                합: 0,
                섭: 0,
                복: 0,
                예정: 0,
            };

            return {
                발: Math.ceil(발 * wk.발),
                찾: Math.ceil(찾 * wk.찾),
                합: Math.ceil(합 * wk.합),
                섭: Math.ceil(섭 * wk.섭),
                복: Math.ceil(복 * wk.복),
                예정: Math.ceil(base * wk.예정),
            };
        });

        return {
            team: teamNum,
            goals: { 발, 찾, 합, 섭, 복, 예정: base },
            weeks,
        };
    });

    // ③ 총계 계산
    const totals = teamResults.reduce(
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

    return { teams: teamResults, totals };
};
/**********************************************
 * PART 4 — calculateWeeklyAchievements
 * 섭 / 복 / 예정은 0.5 + 0.5 분배
 **********************************************/
const calculateWeeklyAchievements = (
    students: Students[],
    selectedMonth: number,
    year: number,
    viewMode: 'region' | 'month'
) => {
    const weekly: Record<string, Record<string, Record<string, Record<Step, number>>>> = {};

    const weekCount = getWeekCount(year, String(selectedMonth));

    const emptyStepRecord: Record<Step, number> = {
        발: 0,
        찾: 0,
        합: 0,
        섭: 0,
        복: 0,
        예정: 0,
    };

    students.forEach((s) => {
        const leaderRegion = (s.인도자지역 ?? '').trim();
        const leaderTeam = getTeamName(s.인도자팀 ?? '');

        if (!REGIONS.includes(leaderRegion as Region)) return;
        if (!fixedTeams.includes(leaderTeam)) return;

        STEPS2.forEach((step) => {
            const dateStr = s[step];
            if (!dateStr) return;

            const date = dayjs(dateStr);
            // 🔥 연도 제한 제거 → cross-year 데이터도 허용
            if (!date.isValid()) return;

            let targets: { 지역: string; 팀: string; 점수: number }[] = [];

            if (step === '발' || step === '찾' || step === '합') {
                targets = [{ 지역: leaderRegion, 팀: leaderTeam, 점수: 1 }];
            } else {
                const teacherRegion = (s.교사지역 ?? '').trim();
                const teacherTeam = getTeamName(s.교사팀 ?? '');

                targets = [
                    { 지역: leaderRegion, 팀: leaderTeam, 점수: 0.5 },
                    { 지역: teacherRegion, 팀: teacherTeam, 점수: 0.5 },
                ];
            }

            targets.forEach(({ 지역, 팀, 점수 }) => {
                if (!지역 || !팀) return;
                if (!REGIONS.includes(지역 as Region)) return;
                if (!fixedTeams.includes(팀)) return;

                const teamNum = 팀.match(/\d+/)?.[0] ?? 팀;

                for (let i = 0; i < weekCount; i++) {
                    const { start, end } = getWeekDateRange(selectedMonth, year, i);

                    // 🔥 여기서 날짜 범위로만 판단 (연도 신경 안 씀)
                    if (!date.isBetween(start, end, 'day', '[]')) continue;

                    weekly[지역] ??= {};
                    weekly[지역][teamNum] ??= {};
                    weekly[지역][teamNum][`week${i + 1}`] ??= { ...emptyStepRecord };

                    weekly[지역][teamNum][`week${i + 1}`][step] += 점수;
                }
            });
        });
    });

    return weekly;
};
