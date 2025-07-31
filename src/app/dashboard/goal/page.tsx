'use client';
import * as React from 'react';
import {
    ConversionRates,
    예정Goals,
    Results,
    TeamResult,
    WeeklyGoals,
    WeeklyPercentages,
    REGIONS,
    DEFAULT_예정_goals,
    Region,
    TableRow,
} from '@/app/lib/types';
import { useState, useEffect, useMemo, useCallback } from 'react';
import dayjs from 'dayjs';
import { useStudentsQuery } from '@/app/hook/useStudentsQuery';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import isBetween from 'dayjs/plugin/isBetween';
import { calculateAchievements, getWeekDateRange, initializeResults } from '@/app/lib/function';
import html2canvas from 'html2canvas';
import { Button, Table } from 'antd';
import { ColumnsType } from 'antd/es/table';
import { useUser } from '@/app/hook/useUser';

dayjs.extend(isBetween);
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const getWeekCount = (year: number, month: string): number => {
    if (year < 2025) return 5;
    if (year === 2025 && Number(month) <= 8) return 5;
    return 8;
};

const steps = ['발', '찾', '합', '섭', '복', '예정'] as const;
type Step = (typeof steps)[number];
interface WeeklyGoalsTableProps {
    data: { region: string; results: Results }[];
    achievements: Record<string, Record<string, Record<string, Record<Step, number>>>>;
    selectedMonth: string;
    selectedYear: number;
    year: number;
    view: 'region' | 'month';
}
const WeeklyGoalsTable = ({ data, achievements, selectedYear, selectedMonth, year, view }: WeeklyGoalsTableProps) => {
    const weekNamesByMonth: string[] =
        getWeekCount(selectedYear, selectedMonth) === 5
            ? ['발집주', '발집주', '상따주', '복따주', '센띄주']
            : ['발집주', '발집주', '육따주', '상담주', '영따주', '복음방주', '복음방주', '센띄,그룹복'];

    const weeks = weekNamesByMonth.map((name, index) => ({
        weekNumber: index + 1,
        weekKey: `week${index + 1}`, // 키 형식을 'week1', 'week2' 등으로 일관성 있게 수정
        label: `${index + 1}주차 (${name})`,
    }));

    const [stepFilterToggle, setStepFilterToggle] = useState<Record<string, boolean>>(
        weeks.reduce((acc, w) => {
            acc[w.weekKey] = false;
            return acc;
        }, {} as Record<string, boolean>)
    );

    const tableRefs = useMemo(() => {
        return weeks.reduce((acc, week) => {
            acc[week.weekKey] = React.createRef<HTMLDivElement>();
            return acc;
        }, {} as Record<string, React.RefObject<HTMLDivElement | null>>);
    }, [weeks]);

    const weekTitleTextRefs = useMemo(() => {
        return weeks.reduce((acc, week) => {
            acc[week.weekKey] = React.createRef<HTMLDivElement>();
            return acc;
        }, {} as Record<string, React.RefObject<HTMLDivElement | null>>);
    }, [weeks]);

    const toggleStepFilter = useCallback((weekKey: string) => {
        setStepFilterToggle((prev) => ({
            ...prev,
            [weekKey]: !prev[weekKey],
        }));
    }, []);

    const saveTableAsImage = useCallback(
        async (weekKey: string, weekIndex: number) => {
            const tempContainer = document.createElement('div');
            tempContainer.style.padding = '24px';
            tempContainer.style.backgroundColor = '#f0f5ff';
            tempContainer.style.maxWidth = '820px';
            tempContainer.style.margin = '0 auto';
            tempContainer.style.borderRadius = '8px';
            tempContainer.style.fontSize = '30px';
            tempContainer.style.boxShadow = '0 0 10px rgba(100, 120, 160, 0.15)';

            const titleEl = weekTitleTextRefs[weekKey]?.current;
            if (titleEl) {
                const titleClone = titleEl.cloneNode(true) as HTMLElement;
                titleClone.style.marginBottom = '8px';
                titleClone.style.fontSize = '36px';
                titleClone.style.color = '#1e3a8a';
                tempContainer.appendChild(titleClone);
            }

            const originalContainer = tableRefs[weekKey]?.current;
            if (!originalContainer) return;
            const tableClone = originalContainer.cloneNode(true) as HTMLElement;

            const table = tableClone.querySelector('table');
            if (table) {
                const tableEl = table as HTMLElement;
                tableEl.style.maxWidth = '800px';
                tableEl.style.width = '100%';
                tableEl.style.borderCollapse = 'collapse';
                tableEl.style.border = '1px solid #cbd5e1';

                const cells = tableEl.querySelectorAll('td, th');
                cells.forEach((cell) => {
                    const row = cell.closest('tr');
                    if (row?.classList.contains('ant-table-measure-row')) return;

                    const cellEl = cell as HTMLElement;
                    cellEl.style.padding = '2px 2px';
                    cellEl.style.height = '28px';
                    cellEl.style.lineHeight = '1.4';
                    cellEl.style.fontSize = '28px';
                    cellEl.style.verticalAlign = 'middle';
                    cellEl.style.backgroundColor = 'transparent';
                    cellEl.style.color = '#374151';
                });

                const rows = tableEl.querySelectorAll('tbody tr');
                rows.forEach((row, idx) => {
                    if (idx % 2 === 1) {
                        (row as HTMLElement).style.backgroundColor = '#f9fafb';
                    }
                });

                const innerDivs = tableEl.querySelectorAll('td > div');
                innerDivs.forEach((div) => {
                    const row = div.closest('tr');
                    if (row?.classList.contains('ant-table-measure-row')) return;

                    const divEl = div as HTMLElement;
                    divEl.style.minHeight = '48px';
                    divEl.style.height = '28px';
                    divEl.style.lineHeight = '28px';
                    divEl.style.display = 'flex';
                    divEl.style.alignItems = 'center';
                    divEl.style.justifyContent = 'center';
                    divEl.style.textAlign = 'center';
                    divEl.style.fontSize = '24px';
                });
            }

            tempContainer.appendChild(tableClone);
            document.body.appendChild(tempContainer);

            try {
                const canvas = await html2canvas(tempContainer, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#f0f5ff',
                });
                const link = document.createElement('a');
                link.download = `${selectedMonth}월_${weekIndex + 1}주차_목표표.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            } catch (error) {
                console.error('Error saving table as image:', error);
            } finally {
                document.body.removeChild(tempContainer);
            }
        },
        [tableRefs, weekTitleTextRefs, selectedMonth]
    );

    return (
        <>
            {weeks.map((week, weekIndex) => {
                const { weekKey } = week;
                const { display } = getWeekDateRange(Number(selectedMonth), year, weekIndex);

                const stepFilter: Step[] = stepFilterToggle[weekKey]
                    ? ['발', '찾', '합', '섭', '복', '예정']
                    : weekIndex === 0
                    ? ['발']
                    : weekIndex === 1
                    ? ['발', '찾']
                    : weekIndex === 2
                    ? ['합']
                    : weekIndex === 3
                    ? ['복']
                    : steps.slice();

                const flatTeams = data.flatMap(
                    ({ region, results }) =>
                        results?.teams?.map((team) => {
                            const teamAch = achievements[region]?.[team.team]?.[weekKey] || {};
                            const goals = team.weeks[weekIndex];
                            const record: Record<string, any> = {
                                key: `${region}-${team.team}`,
                                team: `${region} ${team.team}팀`,
                            };
                            stepFilter.forEach((step) => {
                                const goal = goals?.[step] || 0;
                                const ach = teamAch?.[step] || 0;
                                const rate = goal > 0 ? (ach / goal) * 100 : 0;
                                let colorStyle: React.CSSProperties = {};

                                if (
                                    !stepFilterToggle[weekKey] &&
                                    (weekIndex === 0 || weekIndex === 1) &&
                                    step !== '발'
                                ) {
                                    colorStyle = {};
                                } else {
                                    if (rate >= 100) {
                                        colorStyle = { backgroundColor: '#bfdbfe' };
                                    } else if (rate >= 70) {
                                        colorStyle = { backgroundColor: '#fef9c3' };
                                    } else if (rate <= 30 && goal > 0) {
                                        colorStyle = { backgroundColor: '#f87171', color: '#ffffff' };
                                    }
                                }

                                record[`${step}-goal`] = goal;
                                record[`${step}-ach`] = ach;
                                record[`${step}-rate`] = {
                                    text: rate.toFixed(2) + '%',
                                    style: colorStyle,
                                };
                            });
                            return record;
                        }) ?? []
                );

                const columns: ColumnsType<any> = [
                    {
                        title: '순위',
                        dataIndex: 'no',
                        width: 70,
                        align: 'center',
                        render: (_: any, __: any, index: number) => index + 1,
                    },
                    {
                        title: view === 'region' ? '지역' : '지역/팀',
                        dataIndex: 'team',
                        align: 'center',
                        width: 160,
                    },
                    ...stepFilter.flatMap((step) => [
                        {
                            title: `${step} 목표`,
                            dataIndex: `${step}-goal`,
                            align: 'center' as const,
                            render: (value: number) => (
                                <div style={{ fontWeight: step === '발' && value === 0 ? 'normal' : undefined }}>
                                    {value}
                                </div>
                            ),
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
                            render: (rate: { text: string; style: React.CSSProperties }) => (
                                <div style={{ ...rate.style }}>{rate.text}</div>
                            ),
                        },
                    ]),
                ];

                return (
                    <div
                        key={weekKey}
                        className="mb-10"
                    >
                        <div
                            ref={weekTitleTextRefs[weekKey]}
                            style={{ marginBottom: 8, fontWeight: 'bold' }}
                        >
                            {weekIndex + 1}주차 ({display})
                        </div>

                        <div className="flex justify-end mb-2 space-x-2">
                            <Button
                                type="primary"
                                onClick={() => toggleStepFilter(weekKey)}
                            >
                                {stepFilterToggle[weekKey] ? '필터된 보기' : '전체 보기'}
                            </Button>
                            <Button
                                type="primary"
                                onClick={() => saveTableAsImage(weekKey, weekIndex)}
                            >
                                이미지로 저장
                            </Button>
                        </div>

                        <div
                            ref={tableRefs[weekKey]}
                            className="bg-white p-4 rounded-md shadow-md"
                        >
                            <Table
                                columns={columns}
                                dataSource={flatTeams}
                                pagination={false}
                                bordered
                                size="middle"
                                scroll={{ x: 'max-content' }}
                                rowClassName={(record) => (record.key === 'total' ? 'font-bold bg-green-100' : '')}
                            />
                        </div>
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
    // 'weeks' 변수를 찾을 수 없는 오류 해결을 위해 컴포넌트 내에서 weeks 정의
    const weekNamesByMonth: string[] =
        getWeekCount(year, String(selectedMonth)) === 5
            ? ['발집주', '발집주', '상따주', '복따주', '센띄주']
            : ['발집주', '발집주', '육따주', '상담주', '영따주', '복음방주', '복음방주', '센띄,그룹복'];

    const weeks = useMemo(
        () =>
            weekNamesByMonth.map((name, index) => ({
                weekNumber: index + 1,
                weekKey: `week${index + 1}` as keyof WeeklyPercentages,
                label: `${index + 1}주차 (${name})`,
            })),
        [weekNamesByMonth]
    );

    const labels =
        view === 'region'
            ? data[0].results.teams.map((team) => `${data[0].region} ${team.team}팀`)
            : data.flatMap(({ region, results }) => results.teams.map((team) => `${region} ${team.team}팀`));

    // 'any' 타입 오류 해결을 위해 명시적 타입 지정
    const chartRefs = useMemo(() => {
        return weeks.reduce((acc: Record<string, React.RefObject<HTMLDivElement | null>>, week) => {
            acc[week.weekKey] = React.createRef<HTMLDivElement>();
            return acc;
        }, {});
    }, [weeks]);

    const saveChartAsImage = useCallback(
        async (weekKey: keyof WeeklyPercentages, weekIndex: number) => {
            const chartContainer = chartRefs[weekKey]?.current;
            if (!chartContainer) {
                console.error('Chart ref is null for week:', weekKey);
                return;
            }

            try {
                const canvas = await html2canvas(chartContainer, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                });

                const link = document.createElement('a');
                link.download = `${selectedMonth}월_${weekIndex + 1}주차_그래프.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            } catch (error) {
                console.error('Error saving chart as image:', error);
            }
        },
        [chartRefs, selectedMonth]
    );

    // 'any' 타입 오류 해결을 위해 map 콜백에 타입 지정
    return weeks.map(
        (week: { weekNumber: number; weekKey: keyof WeeklyPercentages; label: string }, weekIndex: number) => {
            const { display } = getWeekDateRange(selectedMonth, year, weekIndex);

            const stepsToShow = (() => {
                switch (weekIndex) {
                    case 0:
                        return ['발'];
                    case 1:
                        return ['발', '찾'];
                    case 2:
                        return ['합'];
                    case 3:
                        return ['섭'];
                    case 4:
                    default:
                        return ['발', '찾', '합', '섭', '복', '예정'];
                }
            })();

            const chartData = {
                labels,
                datasets: stepsToShow
                    .map((step, i) => [
                        {
                            label: `${step} 단계 목표`,
                            data: data.flatMap(({ results }) =>
                                results.teams.map((team) => team.weeks[weekIndex]?.[step as keyof WeeklyGoals] || 0)
                            ),
                            backgroundColor: `rgba(${54 + i * 50}, ${162 - i * 30}, ${235 - i * 40}, 0.3)`,
                            borderColor: `rgba(${54 + i * 50}, ${162 - i * 30}, ${235 - i * 40}, 0.8)`,
                            borderWidth: 1,
                        },
                        {
                            label: `${step} 단계 달성`,
                            data: data.flatMap(({ region, results }) =>
                                results.teams.map(
                                    (team) => achievements[region]?.[`${team.team}`]?.[week.weekKey]?.[step] || 0
                                )
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
                        } ${stepsToShow.join(', ')} 단계 목표 vs 달성`,
                    },
                },
            };

            return (
                <div
                    key={week.weekKey}
                    className="mb-8"
                >
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-md font-medium">
                            {weekIndex + 1}주차 ({display})
                        </h3>
                        <button
                            onClick={() => saveChartAsImage(week.weekKey, weekIndex)}
                            className="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            이미지로 저장
                        </button>
                    </div>
                    <div
                        ref={chartRefs[week.weekKey]}
                        className="chart-container bg-white p-4 rounded-md shadow-md"
                    >
                        <Bar
                            data={chartData}
                            options={options}
                        />
                    </div>
                </div>
            );
        }
    );
};

export default function GoalCalculatorTable() {
    const { user, isLoading: isUserLoading, error: userError } = useUser();
    const { data: students = [], isLoading: isStudentsLoading } = useStudentsQuery();
    const year = 2025;

    const defaultConversionRates = useMemo(
        () => ({
            발To찾: 0.4,
            찾To합: 0.5,
            합To섭: 1.0,
            섭To복: 0.6,
            복To예정: 0.6,
        }),
        []
    );

    const defaultWeeklyPercentages = useMemo(
        () => ({
            week1: { 발: 0.7, 찾: 0.3, 합: 0, 섭: 0.0, 복: 0.0, 예정: 0.0 },
            week2: { 발: 0.3, 찾: 0.7, 합: 0.3, 섭: 0, 복: 0.0, 예정: 0.0 },
            week3: { 발: 0.0, 찾: 0.0, 합: 0.7, 섭: 0, 복: 0.0, 예정: 0.0 },
            week4: { 발: 0.0, 찾: 0.0, 합: 0, 섭: 0.5, 복: 0.0, 예정: 0.0 },
            week5: { 발: 0.0, 찾: 0.0, 합: 0, 섭: 0.5, 복: 0.0, 예정: 0.0 },
            week6: { 발: 0.0, 찾: 0.0, 합: 0, 섭: 0.0, 복: 0.5, 예정: 0.9 },
            week7: { 발: 0.0, 찾: 0.0, 합: 0, 섭: 0.0, 복: 0.5, 예정: 0.5 },
            week8: { 발: 0.0, 찾: 0.0, 합: 0, 섭: 0.0, 복: 0.1, 예정: 0.5 },
        }),
        []
    );

    const [view, setView] = useState<'region' | 'month'>('region');
    const [displayMode, setDisplayMode] = useState<'table' | 'graph'>('table');
    const [region, setRegion] = useState<Region | null>(null);
    const [fGoals, setFGoals] = useState<예정Goals | null>(null);
    const [conversionRates, setConversionRates] = useState<ConversionRates>(defaultConversionRates);
    const [weeklyPercentages, setWeeklyPercentages] = useState<WeeklyPercentages>(defaultWeeklyPercentages);
    const [results, setResults] = useState<Results | null>(null);
    const [error, setError] = useState<string>('');
    const [apiError, setApiError] = useState<string>('');
    const [successMessage, setSuccessMessage] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>(dayjs().month() + 1 + '');
    const [selectedYear, setSelectedYear] = useState<number>(2025);
    const [allRegionsResults, setAllRegionsResults] = useState<{ region: Region; results: Results }[]>([]);

    const { weekly: weeklyAchievements, monthly } = useMemo(
        () => calculateAchievements(students, parseInt(selectedMonth), selectedYear, 'weekly'),
        [students, selectedMonth, selectedYear]
    );

    useEffect(() => {
        if (!isUserLoading && user) {
            const initialRegion = user === 'all' ? '도봉' : (user as Region);
            setRegion(initialRegion);
            setFGoals(DEFAULT_예정_goals[initialRegion]);
            setResults(
                initializeResults(DEFAULT_예정_goals[initialRegion], defaultConversionRates, defaultWeeklyPercentages)
            );
            setView(user === 'all' ? 'region' : 'region');
        }
    }, [isUserLoading, user, defaultConversionRates, defaultWeeklyPercentages]);

    const calculateGoals = useCallback(
        (
            currentFGoals: 예정Goals,
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
            setResults(newResults);
            setError('');
        },
        []
    );

    useEffect(() => {
        if (!region || !fGoals) return;

        const fetchConfig = async () => {
            try {
                const response = await fetch(`/api/goal?region=${region}&month=${selectedMonth}&year=${selectedYear}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch config: ${response.statusText}`);
                }
                const result = await response.json();
                let loadedFGoals, loadedConvRates, loadedWeeklyPerc;
                if (result.data) {
                    loadedFGoals = result.data.예정_goals;
                    loadedConvRates = result.data.conversion_rates;
                    loadedWeeklyPerc = result.data.weekly_percentages;
                    setFGoals(loadedFGoals);
                    setConversionRates(loadedConvRates);
                    setWeeklyPercentages(loadedWeeklyPerc);
                } else {
                    loadedFGoals = DEFAULT_예정_goals[region];
                    loadedConvRates = defaultConversionRates;
                    loadedWeeklyPerc = defaultWeeklyPercentages;
                    setFGoals(loadedFGoals);
                    setConversionRates(loadedConvRates);
                    setWeeklyPercentages(loadedWeeklyPerc);
                }
                calculateGoals(loadedFGoals, loadedConvRates, loadedWeeklyPerc);
                setApiError('');
            } catch (err) {
                setApiError('서버에서 설정을 가져오지 못했습니다.');
                console.error('Fetch config error:', err);
                const defaultFGoals = DEFAULT_예정_goals[region];
                setFGoals(defaultFGoals);
                calculateGoals(defaultFGoals, defaultConversionRates, defaultWeeklyPercentages);
            }
        };
        fetchConfig();
    }, [region, selectedMonth, selectedYear, defaultConversionRates, defaultWeeklyPercentages, calculateGoals]);

    useEffect(() => {
        if (user === 'all') {
            const fetchAllRegionsResults = async () => {
                const resultsByRegion: { region: Region; results: Results }[] = [];
                for (const reg of REGIONS) {
                    try {
                        const response = await fetch(
                            `/api/goal?region=${reg}&month=${selectedMonth}&year=${selectedYear}`
                        );
                        if (!response.ok) {
                            throw new Error(`Failed to fetch config for ${reg}: ${response.statusText}`);
                        }
                        const result = await response.json();
                        const results = initializeResults(
                            result.data?.예정_goals || DEFAULT_예정_goals[reg],
                            result.data?.conversion_rates || defaultConversionRates,
                            result.data?.weekly_percentages || defaultWeeklyPercentages
                        );
                        resultsByRegion.push({ region: reg, results });
                    } catch (err) {
                        console.error(`Fetch config error for ${reg}:`, err);
                        const results = initializeResults(
                            DEFAULT_예정_goals[reg],
                            defaultConversionRates,
                            defaultWeeklyPercentages
                        );
                        resultsByRegion.push({ region: reg, results });
                    }
                }
                setAllRegionsResults(resultsByRegion);
            };
            fetchAllRegionsResults();
        } else if (region && results) {
            setAllRegionsResults([{ region, results }]);
        }
    }, [region, results, selectedMonth, selectedYear, defaultConversionRates, defaultWeeklyPercentages, user]);

    const saveConfig = useCallback(async () => {
        if (!region || !fGoals) {
            setApiError('지역과 F 목표를 설정해야 저장할 수 있습니다.');
            return;
        }

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
                    year: selectedYear,
                    fGoals,
                    conversionRates,
                    weeklyPercentages,
                }),
            });
            if (!response.ok) {
                throw new Error(`Failed to save config: ${response.statusText}`);
            }
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
    }, [region, selectedMonth, selectedYear, fGoals, conversionRates, weeklyPercentages]);

    const handleInputChange = useCallback(
        (
            type: 'fGoal' | 'conversionRate' | 'weeklyPercentage',
            key: string,
            value: string,
            week?: keyof WeeklyPercentages
        ) => {
            if (!fGoals) return;

            let newFGoals = fGoals;
            let newConversionRates = conversionRates;
            let newWeeklyPercentages = weeklyPercentages;

            if (type === 'fGoal') {
                const regex = /^\d*\.?\d*$/;
                if (!regex.test(value) && value !== '') {
                    setError('F 목표는 양수만 입력 가능합니다.');
                    return;
                }
                const numValue = parseFloat(value);
                if (value !== '' && (isNaN(numValue) || numValue < 0)) {
                    setError('F 목표는 유효한 양수이어야 합니다.');
                    return;
                }
                newFGoals = { ...fGoals, [key]: value };
                setFGoals(newFGoals);
            } else if (type === 'conversionRate') {
                const numValue = parseInt(value, 10);
                if (isNaN(numValue) || numValue < 1 || numValue > 100 || !Number.isInteger(parseFloat(value))) {
                    setError('단계향상률은 1~100 사이의 정수 백분율이어야 합니다.');
                    return;
                }
                newConversionRates = { ...conversionRates, [key]: numValue / 100 };
                setConversionRates(newConversionRates);
            } else if (type === 'weeklyPercentage' && week) {
                const num = Number(value);
                if (isNaN(num) || num < 0 || num > 100 || !Number.isInteger(num)) {
                    setError('비율은 0~100 사이의 정수 백분율이어야 합니다.');
                    return;
                }
                const currentWeek = { ...(weeklyPercentages[week] ?? { 발: 0, 찾: 0, 합: 0, 섭: 0, 복: 0, 예정: 0 }) };
                const newValue = num / 100;
                currentWeek[key as keyof WeeklyGoals] = newValue;
                if (newValue === 1) {
                    (steps as ReadonlyArray<keyof WeeklyGoals>).forEach((k) => {
                        if (k !== key) currentWeek[k] = 0;
                    });
                }
                newWeeklyPercentages = { ...weeklyPercentages, [week]: currentWeek };
                setWeeklyPercentages(newWeeklyPercentages);
            }

            setError('');
            calculateGoals(newFGoals, newConversionRates, newWeeklyPercentages);
        },
        [fGoals, conversionRates, weeklyPercentages, calculateGoals]
    );

    const handleRegionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const newRegion = e.target.value as Region;
        setRegion(newRegion);
    }, []);
    const weekNamesByMonth: string[] =
        getWeekCount(selectedYear, selectedMonth) === 5
            ? ['발집주', '발집주', '상따주', '복따주', '센띄주']
            : ['발집주', '발집주', '육따주', '상담주', '영따주', '복음방주', '복음방주', '센띄,그룹복'];

    const weeks = useMemo(
        () =>
            weekNamesByMonth.map((name, index) => ({
                weekNumber: index + 1,
                weekKey: `week${index + 1}` as keyof WeeklyPercentages,
                label: `${index + 1}주차 (${name})`,
            })),
        [weekNamesByMonth]
    );

    const handleMonthChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedMonth(e.target.value),
        []
    );

    if (isUserLoading || isStudentsLoading || !region || !fGoals || !results) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">데이터를 불러오는 중입니다...</p>
                </div>
            </div>
        );
    }

    if (userError) {
        return (
            <div className="flex justify-center items-center h-screen">
                <p className="text-red-600">{userError}</p>
            </div>
        );
    }

    return (
        <div className="w-full mx-auto p-6">
            {user === 'all' && (
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
            )}

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

            {user !== 'all' || view === 'region' ? (
                <>
                    <h1 className="text-2xl font-bold mb-4 text-center">
                        청년회 {selectedMonth}월 {region} 그룹 복음방 개강 4주 플랜 목표 설정
                    </h1>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        {user === 'all' && (
                            <div>
                                <label
                                    htmlFor="region-select"
                                    className="block text-sm font-medium text-gray-700"
                                >
                                    지역 선택:
                                </label>
                                <select
                                    id="region-select"
                                    value={region}
                                    onChange={handleRegionChange}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                >
                                    {REGIONS.map((reg) => (
                                        <option
                                            key={reg}
                                            value={reg}
                                        >
                                            {reg}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div>
                            <label
                                htmlFor="month-select"
                                className="block text-sm font-medium text-gray-700"
                            >
                                월 선택:
                            </label>
                            <select
                                id="month-select"
                                value={selectedMonth}
                                onChange={handleMonthChange}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                    <option
                                        key={month}
                                        value={month}
                                    >
                                        {month}월
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        {Object.keys(fGoals).map((team, index) => (
                            <div key={team}>
                                <label
                                    htmlFor={team}
                                    className="block text-sm font-medium text-gray-700"
                                >
                                    {region} {index + 1}팀 F 목표:
                                </label>
                                <input
                                    type="number"
                                    id={team}
                                    value={fGoals[team]}
                                    onChange={(e) => handleInputChange('fGoal', team, e.target.value)}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    placeholder={`e.g., ${Object.values(DEFAULT_예정_goals[region])[index]}`}
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
                                            <th className="border p-2">발</th>
                                            <th className="border p-2">찾</th>
                                            <th className="border p-2">합</th>
                                            <th className="border p-2">섭</th>
                                            <th className="border p-2">복</th>
                                            <th className="border p-2">예정</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.teams.map((team: TeamResult) => (
                                            <tr key={team.team}>
                                                <td className="border p-2">
                                                    {region} {team.team}팀
                                                </td>
                                                <td className="border p-2 text-center">{Math.round(team.goals.발)}</td>
                                                <td className="border p-2 text-center">{Math.round(team.goals.찾)}</td>
                                                <td className="border p-2 text-center">{Math.round(team.goals.합)}</td>
                                                <td className="border p-2 text-center">{Math.round(team.goals.섭)}</td>
                                                <td className="border p-2 text-center">{Math.round(team.goals.복)}</td>
                                                <td className="border p-2 text-center">
                                                    {Math.round(team.goals.예정)}
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="font-bold">
                                            <td className="border p-2">계</td>
                                            <td className="border p-2 text-center">{Math.round(results.totals.발)}</td>
                                            <td className="border p-2 text-center">{Math.round(results.totals.찾)}</td>
                                            <td className="border p-2 text-center">{Math.round(results.totals.합)}</td>
                                            <td className="border p-2 text-center">{Math.round(results.totals.섭)}</td>
                                            <td className="border p-2 text-center">{Math.round(results.totals.복)}</td>
                                            <td className="border p-2 text-center">
                                                {Math.round(results.totals.예정)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                <h2 className="text-lg font-semibold mb-2">단계향상률</h2>
                                <table className="w-full border-collapse mb-6">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="border p-2">발→찾</th>
                                            <th className="border p-2">찾→합</th>
                                            <th className="border p-2">합→섭</th>
                                            <th className="border p-2">섭→복</th>
                                            <th className="border p-2">복→예정</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            {(Object.keys(conversionRates) as (keyof ConversionRates)[]).map((key) => (
                                                <td
                                                    key={key}
                                                    className="border p-2 text-center"
                                                >
                                                    <input
                                                        type="number"
                                                        value={Math.round(conversionRates[key] * 100)}
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
                                            ))}
                                        </tr>
                                    </tbody>
                                </table>

                                <h2 className="text-lg font-semibold mb-2">주차별 비율 설정</h2>
                                <table className="w-full border-collapse mb-6">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="border p-2">주차</th>
                                            <th className="border p-2">발</th>
                                            <th className="border p-2">찾</th>
                                            <th className="border p-2">합</th>
                                            <th className="border p-2">섭</th>
                                            <th className="border p-2">복</th>
                                            <th className="border p-2">예정</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {weeks.map(({ weekKey, label }) => (
                                            <tr key={weekKey}>
                                                <td className="border p-2">{label}</td>
                                                {(steps as ReadonlyArray<keyof WeeklyGoals>).map((key) => (
                                                    <td
                                                        key={key}
                                                        className="border p-2 text-center"
                                                    >
                                                        <input
                                                            type="number"
                                                            value={Math.round(
                                                                (weeklyPercentages[
                                                                    weekKey as keyof WeeklyPercentages
                                                                ]?.[key] || 0) * 100
                                                            )}
                                                            onChange={(e) =>
                                                                handleInputChange(
                                                                    'weeklyPercentage',
                                                                    key,
                                                                    e.target.value,
                                                                    weekKey
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
                                            {(steps as ReadonlyArray<keyof WeeklyGoals>).map((key) => {
                                                const total = weeks.reduce((sum, { weekKey }) => {
                                                    const value =
                                                        weeklyPercentages[weekKey as keyof WeeklyPercentages]?.[key] ??
                                                        0;
                                                    return sum + value;
                                                }, 0);

                                                return (
                                                    <td
                                                        key={key}
                                                        className="border p-2 text-center"
                                                    >
                                                        {Math.round(total * 100)}%
                                                    </td>
                                                );
                                            })}
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
                                    selectedMonth={selectedMonth}
                                    selectedYear={selectedYear}
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
                                    year={selectedYear}
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
                            <label
                                htmlFor="month-select"
                                className="block text-sm font-medium text-gray-700"
                            >
                                월 선택:
                            </label>
                            <select
                                id="month-select"
                                value={selectedMonth}
                                onChange={handleMonthChange}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                    <option
                                        key={month}
                                        value={month}
                                    >
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
                                    selectedMonth={selectedMonth}
                                    selectedYear={selectedYear}
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
                                                    {(steps as ReadonlyArray<keyof WeeklyGoals>).map((step) => (
                                                        <React.Fragment key={step}>
                                                            <th className="border p-2">{step}</th>
                                                            <th className="border p-2">{`${step}_탈락`}</th>
                                                            <th className="border p-2">{`${step}_보유`}</th>
                                                        </React.Fragment>
                                                    ))}
                                                    <th className="border p-2">총 탈락</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {monthly.achievements.map((row: TableRow) => (
                                                    <tr key={row.key}>
                                                        <td className="border p-2">{row.지역}</td>
                                                        <td className="border p-2">{row.팀}</td>
                                                        {(steps as ReadonlyArray<keyof WeeklyGoals>).map((step) => (
                                                            <React.Fragment key={step}>
                                                                <td className="border p-2 text-center">{row[step]}</td>
                                                                <td className="border p-2 text-center">
                                                                    {row[`${step}_탈락`]}
                                                                </td>
                                                                <td className="border p-2 text-center">
                                                                    {row[`${step}_보유`]}
                                                                </td>
                                                            </React.Fragment>
                                                        ))}
                                                        <td className="border p-2 text-center">{row.탈락}</td>
                                                    </tr>
                                                ))}
                                                <tr className="font-bold">
                                                    <td
                                                        className="border p-2"
                                                        colSpan={2}
                                                    >
                                                        계
                                                    </td>
                                                    {(steps as ReadonlyArray<keyof WeeklyGoals>).map((step) => (
                                                        <React.Fragment key={step}>
                                                            <td className="border p-2 text-center">
                                                                {Math.round(Number(monthly.totalRow[step] ?? 0))}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {Math.round(
                                                                    Number(monthly.totalRow[`${step}_탈락`] ?? 0)
                                                                )}
                                                            </td>
                                                            <td className="border p-2 text-center">
                                                                {Math.round(
                                                                    Number(monthly.totalRow[`${step}_보유`] ?? 0)
                                                                )}
                                                            </td>
                                                        </React.Fragment>
                                                    ))}

                                                    <td className="border p-2 text-center">
                                                        {Math.round(monthly.totalRow.탈락)}
                                                    </td>
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
                                    year={selectedYear}
                                />
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
