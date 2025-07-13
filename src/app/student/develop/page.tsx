'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Table, Button, DatePicker, Select, Spin, message, Typography, Input } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Students, useStudentsBQuery } from '@/app/hook/useStudentsBQuery';
import dayjs from 'dayjs';

const { Option } = Select;
const { Text } = Typography;
const { Search } = Input;

export default function RegionWiseRemarks() {
    const { data: students = [], isLoading } = useStudentsBQuery();
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
    const [targets, setTargets] = useState<Record<number, { month?: string; date?: string; week?: string }>>({});
    const [visibleId, setVisibleId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [savedMessage, setSavedMessage] = useState(false);
    const [searchText, setSearchText] = useState('');

    // 초기 targets 세팅
    useEffect(() => {
        const initialTargets: Record<number, { month?: string; date?: string; week?: string }> = {};
        students.forEach((s) => {
            if (typeof s.번호 === 'number') {
                initialTargets[s.번호] = {
                    month: s.target ?? undefined,
                    date: s.trydate ?? undefined,
                    week: s.numberofweek ?? undefined,
                };
            }
        });
        setTargets(initialTargets);
    }, [students]);

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

    // 전체 지역 목록 생성 (인도자지역, 교사지역 합산)
    const allRegions = useMemo(() => {
        const regions = new Set<string>();
        students.forEach((s) => {
            if (s.인도자지역) regions.add(String(s.인도자지역));
            if (s.교사지역) regions.add(String(s.교사지역));
        });
        return Array.from(regions).sort();
    }, [students]);

    // 필터용 고유값 모음 생성
    const uniqueFilters = useMemo(() => {
        const 단계Set = new Set<string>();
        const 인도자지역Set = new Set<string>();
        const 인도자팀Set = new Set<string>();
        const 인도자이름Set = new Set<string>();
        const 교사지역Set = new Set<string>();
        const 교사팀Set = new Set<string>();
        const 교사이름Set = new Set<string>();

        students.forEach((s) => {
            if (s.단계) 단계Set.add(s.단계);
            if (s.인도자지역) 인도자지역Set.add(String(s.인도자지역));
            if (s.인도자팀) 인도자팀Set.add(String(s.인도자팀));
            if (s.인도자이름) 인도자이름Set.add(String(s.인도자이름));
            if (s.교사지역) 교사지역Set.add(String(s.교사지역));
            if (s.교사팀) 교사팀Set.add(String(s.교사팀));
            if (s.교사이름) 교사이름Set.add(String(s.교사이름));
        });

        const toFilters = (set: Set<string>) =>
            Array.from(set)
                .filter((v) => v !== '')
                .sort()
                .map((value) => ({ text: value, value }));

        return {
            단계: toFilters(단계Set),
            인도자지역: toFilters(인도자지역Set),
            인도자팀: toFilters(인도자팀Set),
            인도자이름: toFilters(인도자이름Set),
            교사지역: toFilters(교사지역Set),
            교사팀: toFilters(교사팀Set),
            교사이름: toFilters(교사이름Set),
        };
    }, [students]);

    // 필터링 + 검색 + 지역 필터 적용
    const filtered = useMemo(() => {
        return students.filter((s) => {
            // 단계 B인 경우 인도자지역 기준, 그 외 교사지역 기준 필터링
            const 기준지역 = s.단계?.toLowerCase() === 'b' ? String(s.인도자지역 ?? '') : String(s.교사지역 ?? '');
            const matchesRegion = !selectedRegion || 기준지역 === selectedRegion;
            const matchesSearch = !searchText || (s.이름?.includes(searchText) ?? false);
            return matchesRegion && matchesSearch;
        });
    }, [students, selectedRegion, searchText]);

    // 각 필드 변경 핸들러
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

    const handleWeekChange = (번호: number, value: string) => {
        setTargets((prev) => ({
            ...prev,
            [번호]: { ...prev[번호], week: value },
        }));
    };

    const columns: ColumnsType<Students> = [
        {
            title: '단계',
            dataIndex: '단계',
            key: '단계',
            width: 20,
            filters: uniqueFilters.단계,
            onFilter: (value, record) => record.단계 === value,
            sorter: (a, b) => (a.단계 || '').localeCompare(b.단계 || ''),
        },
        {
            title: '이름',
            dataIndex: '이름',
            key: '이름',
            width: 50,
            sorter: (a, b) => (a.이름 || '').localeCompare(b.이름 || ''),
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
        {
            title: '인도자지역',
            dataIndex: '인도자지역',
            key: '인도자지역',
            width: 60,
            filters: uniqueFilters.인도자지역,
            onFilter: (value, record) => String(record.인도자지역) === value,
            sorter: (a, b) => String(a.인도자지역).localeCompare(String(b.인도자지역)),
        },
        {
            title: '인도자팀',
            dataIndex: '인도자팀',
            key: '인도자팀',
            width: 60,
            filters: uniqueFilters.인도자팀,
            onFilter: (value, record) => String(record.인도자팀) === value,
            sorter: (a, b) => String(a.인도자팀).localeCompare(String(b.인도자팀)),
        },
        {
            title: '인도자이름',
            dataIndex: '인도자이름',
            key: '인도자이름',
            width: 60,
            filters: uniqueFilters.인도자이름,
            onFilter: (value, record) => String(record.인도자이름) === value,
            sorter: (a, b) => String(a.인도자이름).localeCompare(String(b.인도자이름)),
        },
        {
            title: '교사지역',
            dataIndex: '교사지역',
            key: '교사지역',
            width: 60,
            filters: uniqueFilters.교사지역,
            onFilter: (value, record) => String(record.교사지역) === value,
            sorter: (a, b) => String(a.교사지역).localeCompare(String(b.교사지역)),
        },
        {
            title: '교사팀',
            dataIndex: '교사팀',
            key: '교사팀',
            width: 60,
            filters: uniqueFilters.교사팀,
            onFilter: (value, record) => String(record.교사팀) === value,
            sorter: (a, b) => String(a.교사팀).localeCompare(String(b.교사팀)),
        },
        {
            title: '교사이름',
            dataIndex: '교사이름',
            key: '교사이름',
            width: 60,
            filters: uniqueFilters.교사이름,
            onFilter: (value, record) => String(record.교사이름) === value,
            sorter: (a, b) => String(a.교사이름).localeCompare(String(b.교사이름)),
        },
        {
            title: '목표 월',
            key: '목표월',
            width: 60,
            render: (_, record) => (
                <Select
                    value={targets[record.번호]?.month}
                    onChange={(value) => handleMonthChange(record.번호, value)}
                    style={{ width: '100%' }}
                    placeholder="선택"
                    allowClear
                    key={`month-select-${record.번호}`}
                >
                    {monthOptions.map((m) => (
                        <Option
                            key={m}
                            value={m}
                        >
                            {m}
                        </Option>
                    ))}
                </Select>
            ),
        },
        {
            title: '실행 일자',
            key: '실행일자',
            width: 80,
            render: (_, record) => (
                <DatePicker
                    style={{ width: '100%' }}
                    value={targets[record.번호]?.date ? dayjs(targets[record.번호].date) : null}
                    onChange={(date) => handleDateChange(record.번호, date)}
                    format="YYYY-MM-DD"
                    key={`date-picker-${record.번호}`}
                />
            ),
        },
        {
            title: '주횟수',
            key: '주횟수',
            width: 100,
            render: (_, record) => (
                <Select
                    style={{ width: '100%' }}
                    value={targets[record.번호]?.week ?? '미수강'}
                    onChange={(value) => handleWeekChange(record.번호, value)}
                    options={[
                        { value: '1회', label: '1회' },
                        { value: '2회', label: '2회' },
                        { value: '3회', label: '3회' },
                        { value: '4회이상', label: '4회이상' },
                        { value: '미수강', label: '미수강' },
                    ]}
                    placeholder="선택"
                />
            ),
        },
    ];

    // 저장 함수
    const handleSave = async () => {
        if (saving) return;

        try {
            setSaving(true);
            const payload = Object.entries(targets).map(([번호Str, value]) => ({
                번호: Number(번호Str),
                month: value.month ?? null,
                date: value.date ?? null,
                week: value.week ?? null,
            }));

            const res = await fetch('/api/update-targets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targets: payload }),
            });

            const result = await res.json();

            if (res.ok) {
                setSavedMessage(true);
                message.success('저장되었습니다.');
                setTimeout(() => setSavedMessage(false), 2000);
            } else {
                message.error(result?.error || '저장에 실패했습니다.');
            }
        } catch (err) {
            console.error(err);
            message.error('저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Spin
            spinning={isLoading || saving}
            tip={saving ? '저장 중입니다...' : '데이터를 불러오는 중입니다...'}
        >
            <div className="p-6">
                <h2 className="text-xl font-bold mb-4">지역별 B 이상 특이사항 관리</h2>

                <div className="sticky top-0 z-50 bg-white border-b border-gray-300 flex flex-wrap items-center justify-between gap-2 px-2 py-3">
                    <div className="flex flex-wrap gap-2 flex-1 min-w-0 overflow-x-auto">
                        <Button
                            type={!selectedRegion ? 'primary' : 'default'}
                            onClick={() => setSelectedRegion(null)}
                        >
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

                    <div className="ml-4 flex-shrink-0 flex items-center gap-3">
                        <Search
                            placeholder="이름 검색"
                            onSearch={(value) => setSearchText(value.trim())}
                            onChange={(e) => setSearchText(e.target.value.trim())}
                            style={{ width: 200 }}
                            allowClear
                            value={searchText}
                        />
                        {savedMessage && <Text type="success">✅ 저장 완료</Text>}
                        <Button
                            type="primary"
                            onClick={handleSave}
                            disabled={saving}
                        >
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
