'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Table, Button, DatePicker, Select, Spin, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Students, useStudentsBQuery } from '@/app/hook/useStudentsBQuery';
import dayjs from 'dayjs';

const { Option } = Select;

export default function RegionWiseRemarks() {
    const { data: students = [], isLoading } = useStudentsBQuery();
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
    const [targets, setTargets] = useState<Record<number, { month?: string; date?: string }>>({});
    const [visibleId, setVisibleId] = useState<number | null>(null);

    useEffect(() => {
        const initialTargets: Record<number, { month?: string; date?: string }> = {};
        students.forEach((s) => {
            if (typeof s.번호 === 'number') {
                initialTargets[s.번호] = targets[s.번호] || {
                    month: s.target ?? undefined,
                    date: s.trydate ?? undefined,
                };
            }
        });
        setTargets(initialTargets);
    }, []);

    const currentMonth = dayjs().month();
    const monthOptions = useMemo(() => {
        const options = [];
        for (let i = 0; i < 3; i++) {
            const m = (currentMonth + i) % 12;
            options.push(`${m + 1}월`);
        }
        options.push('장기');
        return options;
    }, [currentMonth]);

    const allRegions = useMemo(() => {
        const regions = new Set<string>();
        students.forEach((s) => {
            if (s.인도자지역) regions.add(String(s.인도자지역));
            if (s.교사지역) regions.add(String(s.교사지역));
        });
        return Array.from(regions).sort();
    }, [students]);

    const filtered = useMemo(() => {
        return students.filter((s) => {
            const 기준지역 = s.단계?.toLowerCase() === 'b' ? String(s.인도자지역 ?? '') : String(s.교사지역 ?? '');
            return !selectedRegion || 기준지역 === selectedRegion;
        });
    }, [students, selectedRegion]);

    const handleMonthChange = (번호: number, value: string) => {
        setTargets((prev) => ({
            ...prev,
            [번호]: { ...prev[번호], month: value },
        }));
    };

    const handleDateChange = (번호: number, date: dayjs.Dayjs | null) => {
        setTargets((prev) => ({
            ...prev,
            [번호]: { ...prev[번호], date: date ? date.format('YYYY-MM-DD') : undefined },
        }));
    };

    const columns: ColumnsType<Students> = [
        { title: '단계', dataIndex: '단계', key: '단계', width: 40 },
        {
            title: '이름',
            dataIndex: '이름',
            key: '이름',
            width: 80,
            render: (name: string, record) => {
                const isVisible = visibleId === record.번호;
                const maskedName = (() => {
                    const len = name.length;
                    if (len === 2) return name[0] + 'O';
                    if (len === 3) return name[0] + 'O' + name[2];
                    if (len >= 4) return name[0] + 'O'.repeat(len - 2) + name[len - 1];
                    return name;
                })();
                return (
                    <div
                        onClick={() => {
                            if (typeof record.번호 === 'number') {
                                setVisibleId(isVisible ? null : record.번호);
                            }
                        }}
                        className="cursor-pointer flex items-center gap-1"
                    >
                        <span>{isVisible ? name : maskedName}</span>
                    </div>
                );
            },
        },
        { title: '인도자지역', dataIndex: '인도자지역', key: '인도자지역', width: 60 },
        { title: '인도자팀', dataIndex: '인도자팀', key: '인도자팀', width: 60 },
        { title: '인도자이름', dataIndex: '인도자이름', key: '인도자이름', width: 60 },
        { title: '교사지역', dataIndex: '교사지역', key: '교사지역', width: 60 },
        { title: '교사팀', dataIndex: '교사팀', key: '교사팀', width: 60 },
        { title: '교사이름', dataIndex: '교사이름', key: '교사이름', width: 60 },
        {
            title: '목표 월',
            key: '목표월',
            width: 60,
            render: (_, record) => {
                if (typeof record.번호 !== 'number') return null;
                return (
                    <Select
                        value={targets[record.번호]?.month}
                        onChange={(value) => handleMonthChange(record.번호, value)}
                        style={{ width: '100%' }}
                        placeholder="선택"
                        allowClear
                        key={`month-select-${record.번호}`}
                    >
                        {monthOptions.map((m) => (
                            <Option key={m} value={m}>
                                {m}
                            </Option>
                        ))}
                    </Select>
                );
            },
        },
        {
            title: '실행 일자',
            key: '실행일자',
            width: 80,
            render: (_, record) => {
                if (typeof record.번호 !== 'number') return null;
                return (
                    <DatePicker
                        style={{ width: '100%' }}
                        value={targets[record.번호]?.date ? dayjs(targets[record.번호].date) : null}
                        onChange={(date) => handleDateChange(record.번호, date)}
                        format="YYYY-MM-DD"
                        key={`date-picker-${record.번호}`}
                    />
                );
            },
        },
    ];

    const handleSave = async () => {
        try {
            const payload = Object.entries(targets).map(([번호Str, value]) => ({
                번호: Number(번호Str),
                month: value.month ?? null,
                date: value.date ?? null,
            }));

            const res = await fetch('/api/update-targets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targets: payload }),
            });

            const result = await res.json();

            if (res.ok) {
                message.success('저장되었습니다.');
            } else {
                message.error(result?.error || '저장에 실패했습니다.');
            }
        } catch (err) {
            console.error(err);
            message.error('저장 중 오류가 발생했습니다.');
        }
    };

    return (
        <Spin spinning={isLoading} tip="데이터를 불러오는 중입니다...">
            <div className="p-6">
                <h2 className="text-xl font-bold mb-4">지역별 B 이상 특이사항 관리</h2>
                <div className="sticky top-0 z-50 bg-white border-b border-gray-300 flex flex-wrap items-center justify-between gap-2 px-2 py-3">
                    <div className="flex flex-wrap gap-2 flex-1 min-w-0 overflow-x-auto">
                        <Button type={!selectedRegion ? 'primary' : 'default'} onClick={() => setSelectedRegion(null)}>
                            전체
                        </Button>
                        {allRegions.map((region) => (
                            <Button
                                key={region}
                                type={selectedRegion === region ? 'primary' : 'default'}
                                onClick={() => setSelectedRegion(region)}
                            >
                                {region}
                            </Button>
                        ))}
                    </div>
                    <div className="ml-4 flex-shrink-0">
                        <Button type="primary" onClick={handleSave}>
                            저장
                        </Button>
                    </div>
                </div>
                <Table
                    dataSource={filtered}
                    rowKey="번호"
                    columns={columns}
                    pagination={{ pageSize: 50 }}
                    scroll={{ x: 1000 }}
                    size="middle"
                    className="mt-4"
                />
            </div>
        </Spin>
    );
}
