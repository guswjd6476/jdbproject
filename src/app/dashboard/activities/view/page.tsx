'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, DatePicker, Input, Select, Spin, Table, Tabs } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import Link from 'next/link';
import { useUser } from '@/app/hook/useUser';

type Role = '노방' | '온라인' | '만남' | '교사' | '잎사귀';
const ROLES: Role[] = ['노방', '온라인', '만남', '교사', '잎사귀'];

type TabKey = 'all' | 'region' | 'log';
type PeriodType = 'daily' | 'weekly' | 'monthly';
type RegionGroupBy = 'team' | 'team_subteam';

type RateRow = {
    key: string;
    region: string | null;
    team: string | null;
    subteam: string | null;
    total_members: number;
    active_members: number;
    activity_rate: number;
    start_date: string;
    end_date: string;
    base_date: string;
    period_type: string;
};

type LogRow = {
    id: number | string;
    날짜: string | null;
    지역: string | null;
    팀: string | null;
    이름: string | null;
    활동: string | null;
    memo: string | null;
    created_at: string | null;
    고유번호: string | null;
};

type LogMeta = {
    total: number;
    page: number;
    pageSize: number;
};

export default function ActivitiesViewPage() {
    const { isAdmin, isLoading } = useUser();

    const [tab, setTab] = useState<TabKey>('all');

    const [baseDate, setBaseDate] = useState<Dayjs>(dayjs());
    const [periodType, setPeriodType] = useState<PeriodType>('weekly');

    const [selectedRegion, setSelectedRegion] = useState<string>('강북');
    const [regionGroupBy, setRegionGroupBy] = useState<RegionGroupBy>('team');

    const [logFrom, setLogFrom] = useState<Dayjs>(dayjs().subtract(7, 'day'));
    const [logTo, setLogTo] = useState<Dayjs>(dayjs());
    const [logRole, setLogRole] = useState<Role | ''>('');
    const [logQ, setLogQ] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [allRegionRows, setAllRegionRows] = useState<RateRow[]>([]);
    const [allRegionTeamRows, setAllRegionTeamRows] = useState<RateRow[]>([]);
    const [regionRows, setRegionRows] = useState<RateRow[]>([]);

    const [logRows, setLogRows] = useState<LogRow[]>([]);
    const [logMeta, setLogMeta] = useState<LogMeta>({
        total: 0,
        page: 1,
        pageSize: 50,
    });

    const fetchJson = useCallback(async (url: string) => {
        const res = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
        });

        let result: any = null;
        try {
            result = await res.json();
        } catch {
            result = null;
        }

        if (!res.ok || result?.success === false) {
            throw new Error(result?.error || result?.message || '조회 실패');
        }

        return result;
    }, []);

    const logQueryString = useMemo(() => {
        const sp = new URLSearchParams();
        sp.set('mode', 'log');
        sp.set('from', logFrom.format('YYYY-MM-DD'));
        sp.set('to', logTo.format('YYYY-MM-DD'));
        sp.set('page', String(logMeta.page));
        sp.set('pageSize', String(logMeta.pageSize));

        if (logRole) sp.set('role', logRole);
        if (logQ.trim()) sp.set('q', logQ.trim());

        return sp.toString();
    }, [logFrom, logTo, logMeta.page, logMeta.pageSize, logRole, logQ]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            if (tab === 'all') {
                const base = baseDate.format('YYYY-MM-DD');

                const [regionRes, regionTeamRes] = await Promise.all([
                    fetchJson(`/api/activity-rate?scope=all&periodType=${periodType}&baseDate=${base}&groupBy=region`),
                    fetchJson(
                        `/api/activity-rate?scope=all&periodType=${periodType}&baseDate=${base}&groupBy=region_team`
                    ),
                ]);

                setAllRegionRows(Array.isArray(regionRes?.rows) ? regionRes.rows : []);
                setAllRegionTeamRows(Array.isArray(regionTeamRes?.rows) ? regionTeamRes.rows : []);
            }

            if (tab === 'region') {
                const base = baseDate.format('YYYY-MM-DD');

                const res = await fetchJson(
                    `/api/activity-rate?scope=region&region=${encodeURIComponent(
                        selectedRegion
                    )}&periodType=${periodType}&baseDate=${base}&groupBy=${regionGroupBy}`
                );

                setRegionRows(Array.isArray(res?.rows) ? res.rows : []);
            }

            if (tab === 'log') {
                if (logFrom.isAfter(logTo, 'day')) {
                    throw new Error('로그 조회 시작일은 종료일보다 늦을 수 없습니다.');
                }

                const res = await fetchJson(`/api/activities?${logQueryString}`);

                setLogRows(Array.isArray(res?.rows) ? res.rows : []);
                setLogMeta((prev) => ({
                    ...prev,
                    ...(res?.meta ?? {}),
                }));
            }
        } catch (e: any) {
            setError(e?.message ?? '조회 실패');

            if (tab === 'all') {
                setAllRegionRows([]);
                setAllRegionTeamRows([]);
            } else if (tab === 'region') {
                setRegionRows([]);
            } else {
                setLogRows([]);
            }
        } finally {
            setLoading(false);
        }
    }, [tab, baseDate, periodType, selectedRegion, regionGroupBy, logFrom, logTo, logQueryString, fetchJson]);

    useEffect(() => {
        if (!isAdmin) return;
        fetchData();
    }, [fetchData, isAdmin]);

    const rateColumns = [
        { title: '구분', dataIndex: 'key' },
        { title: '지역', dataIndex: 'region' },
        { title: '팀', dataIndex: 'team' },
        { title: '구역', dataIndex: 'subteam' },
        { title: '전체 인원', dataIndex: 'total_members' },
        { title: '활동 인원', dataIndex: 'active_members' },
        {
            title: '활동율(%)',
            dataIndex: 'activity_rate',
            sorter: (a: RateRow, b: RateRow) => a.activity_rate - b.activity_rate,
        },
        { title: '기간 시작', dataIndex: 'start_date' },
        { title: '기간 종료', dataIndex: 'end_date' },
    ];

    const logColumns = [
        { title: '날짜', dataIndex: '날짜' },
        { title: '지역', dataIndex: '지역' },
        { title: '팀', dataIndex: '팀' },
        { title: '이름', dataIndex: '이름' },
        { title: '활동', dataIndex: '활동' },
        { title: '메모', dataIndex: 'memo' },
        { title: '등록시각', dataIndex: 'created_at' },
        { title: '고유번호', dataIndex: '고유번호' },
    ];

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-[80vh]">
                <Spin size="large" />
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="p-10 text-center">
                <Alert
                    message="접근 권한 없음"
                    type="error"
                    showIcon
                />
                <Link href="/student/view">
                    <Button
                        type="primary"
                        className="mt-5"
                    >
                        조회 페이지로 돌아가기
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="p-4">
            <div className="sticky top-0 z-10 bg-white pb-3 border-b border-gray-200">
                {tab !== 'log' ? (
                    <div className="flex flex-wrap gap-2 items-end">
                        <div>
                            <div className="text-xs text-gray-500">기준일</div>
                            <DatePicker
                                value={baseDate}
                                onChange={(v) => v && setBaseDate(v)}
                            />
                        </div>

                        <div style={{ minWidth: 140 }}>
                            <div className="text-xs text-gray-500">기간</div>
                            <Select
                                value={periodType}
                                onChange={(v) => setPeriodType(v)}
                                options={[
                                    { value: 'daily', label: '일간' },
                                    { value: 'weekly', label: '주간' },
                                    { value: 'monthly', label: '월간' },
                                ]}
                            />
                        </div>

                        {tab === 'region' && (
                            <>
                                <div style={{ minWidth: 160 }}>
                                    <div className="text-xs text-gray-500">지역</div>
                                    <Input
                                        value={selectedRegion}
                                        onChange={(e) => setSelectedRegion(e.target.value)}
                                        placeholder="예: 강북"
                                    />
                                </div>

                                <div style={{ minWidth: 180 }}>
                                    <div className="text-xs text-gray-500">조회 단위</div>
                                    <Select
                                        value={regionGroupBy}
                                        onChange={(v) => setRegionGroupBy(v)}
                                        options={[
                                            { value: 'team', label: '팀별 활동율' },
                                            { value: 'team_subteam', label: '팀+구역별 활동율' },
                                        ]}
                                    />
                                </div>
                            </>
                        )}

                        <Button
                            onClick={fetchData}
                            disabled={loading}
                        >
                            새로고침
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2 items-end">
                        <div>
                            <div className="text-xs text-gray-500">from</div>
                            <DatePicker
                                value={logFrom}
                                onChange={(v) => v && setLogFrom(v)}
                            />
                        </div>

                        <div>
                            <div className="text-xs text-gray-500">to</div>
                            <DatePicker
                                value={logTo}
                                onChange={(v) => v && setLogTo(v)}
                            />
                        </div>

                        <div style={{ minWidth: 160 }}>
                            <div className="text-xs text-gray-500">활동</div>
                            <Select
                                value={logRole || undefined}
                                allowClear
                                placeholder="전체"
                                onClear={() => setLogRole('')}
                                onChange={(v) => setLogRole((v as Role) || '')}
                                options={ROLES.map((r) => ({ value: r, label: r }))}
                            />
                        </div>

                        <div style={{ minWidth: 260 }}>
                            <div className="text-xs text-gray-500">검색(이름/지역/팀)</div>
                            <Input
                                value={logQ}
                                onChange={(e) => setLogQ(e.target.value)}
                                placeholder="예: 강북, 2, 강현정"
                                allowClear
                                onPressEnter={fetchData}
                            />
                        </div>

                        <Button
                            onClick={fetchData}
                            disabled={loading}
                        >
                            새로고침
                        </Button>
                    </div>
                )}

                {error && (
                    <div className="mt-2">
                        <Alert
                            message={error}
                            type="error"
                            showIcon
                        />
                    </div>
                )}
            </div>

            <div className="mt-3">
                <Tabs
                    activeKey={tab}
                    onChange={(k) => setTab(k as TabKey)}
                    items={[
                        {
                            key: 'all',
                            label: '청년회 전체',
                            children: (
                                <Spin spinning={loading}>
                                    <div className="space-y-6">
                                        <div>
                                            <div className="font-semibold mb-2">각 지역 활동율</div>
                                            <Table
                                                rowKey={(r) => `all-region-${r.key}`}
                                                columns={rateColumns as any}
                                                dataSource={allRegionRows}
                                                pagination={false}
                                                size="middle"
                                            />
                                        </div>

                                        <div>
                                            <div className="font-semibold mb-2">각 지역의 팀별 활동율</div>
                                            <Table
                                                rowKey={(r) => `all-region-team-${r.key}`}
                                                columns={rateColumns as any}
                                                dataSource={allRegionTeamRows}
                                                pagination={false}
                                                size="middle"
                                            />
                                        </div>
                                    </div>
                                </Spin>
                            ),
                        },
                        {
                            key: 'region',
                            label: '지역별',
                            children: (
                                <Spin spinning={loading}>
                                    <Table
                                        rowKey={(r) => `region-${r.key}`}
                                        columns={rateColumns as any}
                                        dataSource={regionRows}
                                        pagination={false}
                                        size="middle"
                                    />
                                </Spin>
                            ),
                        },
                        {
                            key: 'log',
                            label: '활동 로그',
                            children: (
                                <Spin spinning={loading}>
                                    <Table
                                        rowKey={(r) => String(r.id)}
                                        columns={logColumns as any}
                                        dataSource={logRows}
                                        pagination={{
                                            current: logMeta.page,
                                            pageSize: logMeta.pageSize,
                                            total: logMeta.total,
                                            showSizeChanger: true,
                                            pageSizeOptions: [20, 50, 100, 200],
                                            onChange: (page, pageSize) => {
                                                setLogMeta((prev) => ({
                                                    ...prev,
                                                    page,
                                                    pageSize,
                                                }));
                                            },
                                        }}
                                        size="middle"
                                    />
                                </Spin>
                            ),
                        },
                    ]}
                />
            </div>

            <div className="text-sm text-gray-500 mt-3">
                활동율은 해당 기간 동안 <b>1번이라도 활동한 사람</b>을 1명으로 계산합니다. 같은 사람이 노방/교사/만남을
                여러 번 해도 활동인원은 중복되지 않습니다.
            </div>
        </div>
    );
}
