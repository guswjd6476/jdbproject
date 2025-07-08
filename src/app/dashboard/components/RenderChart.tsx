'use client';

import React, { useCallback, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { Bar } from 'react-chartjs-2';
import type { Results, WeeklyGoals, WeeklyPercentages } from '@/app/lib/types';

interface RenderChartProps {
    view: 'region' | 'month';
    data: { region: string; results: Results }[];
    achievements: Record<string, Record<string, Record<string, Record<string, number>>>>;
    selectedMonth: number;
    year: number;
}

const weeks = ['week1', 'week2', 'week3', 'week4', 'week5'] as (keyof WeeklyPercentages)[];

const getWeekDateRange = (month: number, year: number, weekIndex: number) => {
    const display = `${month}월 ${weekIndex + 1}주차`;
    return { display };
};

const RenderChart: React.FC<RenderChartProps> = ({ view, data, achievements, selectedMonth, year }) => {
    const labels =
        view === 'region'
            ? data[0].results.teams.map((team) => `${data[0].region} ${team.team}팀`)
            : data.flatMap(({ region, results }) => results.teams.map((team) => `${region} ${team.team}팀`));

    const chartRefs = useMemo(() => {
        return weeks.reduce((acc, week) => {
            acc[week] = React.createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement | null>;
            return acc;
        }, {} as Record<keyof WeeklyPercentages, React.RefObject<HTMLDivElement | null>>);
    }, []);

    const saveChartAsImage = useCallback(
        async (week: keyof WeeklyPercentages, weekIndex: number) => {
            const chartContainer = chartRefs[week].current;
            if (!chartContainer) return;

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

    return (
        <>
            {weeks.map((week, weekIndex) => {
                const { display } = getWeekDateRange(selectedMonth, year, weekIndex);

                const stepsToShow = (() => {
                    switch (weekIndex) {
                        case 0:
                            return ['A'];
                        case 1:
                            return ['A', 'B'];
                        case 2:
                            return ['C'];
                        case 3:
                            return ['D'];
                        case 4:
                            return ['A', 'B', 'C', 'D', 'F'];
                        default:
                            return ['A', 'B', 'C', 'D', 'F'];
                    }
                })();

                const chartData = {
                    labels,
                    datasets: stepsToShow
                        .map((step, i) => [
                            {
                                label: `${step} 단계 목표`,
                                data: data.flatMap(({ results }) =>
                                    results.teams.map((team) => team.weeks[weekIndex][step as keyof WeeklyGoals] || 0)
                                ),
                                backgroundColor: `rgba(${54 + i * 50}, ${162 - i * 30}, ${235 - i * 40}, 0.3)`,
                                borderColor: `rgba(${54 + i * 50}, ${162 - i * 30}, ${235 - i * 40}, 0.8)`,
                                borderWidth: 1,
                            },
                            {
                                label: `${step} 단계 달성`,
                                data: data.flatMap(({ region, results }) =>
                                    results.teams.map((team) => achievements[region]?.[team.team]?.[week]?.[step] || 0)
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
                    <div key={week} className="mb-8">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-md font-medium">
                                {weekIndex + 1}주차 ({display})
                            </h3>
                            <button
                                onClick={() => saveChartAsImage(week, weekIndex)}
                                className="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                이미지로 저장
                            </button>
                        </div>
                        <div ref={chartRefs[week]} className="chart-container">
                            <Bar data={chartData} options={options} />
                        </div>
                    </div>
                );
            })}
        </>
    );
};

export default RenderChart;
