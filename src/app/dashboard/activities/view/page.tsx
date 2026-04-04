'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, DatePicker, Input, Select, Spin, Table, Tabs } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { useUser } from '@/app/hook/useUser';

type Role = '노방' | '온라인' | '만남' | '교사' | '잎사귀';
const ROLES: Role[] = ['노방', '온라인', '만남', '교사', '잎사귀'];

type TabKey = 'all' | 'region' | 'log' | 'weekly-board';
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

type WeeklyBoardRow = {
    key: string;
    region: string | null;
    team: string | null;
    subteam: string | null;
    monday_count: number;
    tuesday_count: number;
    wednesday_count: number;
    thursday_count: number;
    friday_count: number;
    saturday_count: number;
    sunday_count: number;
    total_active_members: number;
    reported_days_count: number;
    missing_days: string[];
    week_start: string;
    week_end: string;
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

    const [weeklyBoardRows, setWeeklyBoardRows] = useState<WeeklyBoardRow[]>([]);

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
    const fetchAllLogsForExport = useCallback(async () => {
        if (logFrom.isAfter(logTo, 'day')) {
            throw new Error('로그 조회 시작일은 종료일보다 늦을 수 없습니다.');
        }

        const sp = new URLSearchParams();
        sp.set('mode', 'log');
        sp.set('from', logFrom.format('YYYY-MM-DD'));
        sp.set('to', logTo.format('YYYY-MM-DD'));
        sp.set('export', '1');

        if (logRole) sp.set('role', logRole);
        if (logQ.trim()) sp.set('q', logQ.trim());

        const res = await fetchJson(`/api/activities?${sp.toString()}`);
        return Array.isArray(res?.rows) ? res.rows : [];
    }, [fetchJson, logFrom, logTo, logRole, logQ]);
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

            if (tab === 'weekly-board') {
                const base = baseDate.format('YYYY-MM-DD');
                const res = await fetchJson(`/api/activities/weekly-board?baseDate=${base}`);
                setWeeklyBoardRows(Array.isArray(res?.rows) ? res.rows : []);
            }
        } catch (e: any) {
            setError(e?.message ?? '조회 실패');

            if (tab === 'all') {
                setAllRegionRows([]);
                setAllRegionTeamRows([]);
            } else if (tab === 'region') {
                setRegionRows([]);
            } else if (tab === 'log') {
                setLogRows([]);
            } else if (tab === 'weekly-board') {
                setWeeklyBoardRows([]);
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

    const weeklyBoardColumns = [
        { title: '지역', dataIndex: 'region', fixed: 'left' as const },
        { title: '팀', dataIndex: 'team', fixed: 'left' as const },
        { title: '구역', dataIndex: 'subteam', fixed: 'left' as const },
        { title: '월', dataIndex: 'monday_count' },
        { title: '화', dataIndex: 'tuesday_count' },
        { title: '수', dataIndex: 'wednesday_count' },
        { title: '목', dataIndex: 'thursday_count' },
        { title: '금', dataIndex: 'friday_count' },
        { title: '토', dataIndex: 'saturday_count' },
        { title: '일', dataIndex: 'sunday_count' },
        { title: '주간 활동자수', dataIndex: 'total_active_members' },
        { title: '보고한 요일수', dataIndex: 'reported_days_count' },
        {
            title: '미보고 요일',
            dataIndex: 'missing_days',
            render: (v: string[]) => (Array.isArray(v) && v.length ? v.join(', ') : '-'),
        },
        { title: '주 시작', dataIndex: 'week_start' },
        { title: '주 종료', dataIndex: 'week_end' },
    ];

    const exportToExcel = useCallback(async () => {
        const wb = XLSX.utils.book_new();

        const safeSheet = (name: string) => name.replace(/[\\/?*[\]:]/g, '').slice(0, 31);

        if (tab === 'all') {
            const sheet1 = XLSX.utils.json_to_sheet(
                allRegionRows.map((r) => ({
                    구분: r.key,
                    지역: r.region,
                    팀: r.team,
                    구역: r.subteam,
                    전체인원: r.total_members,
                    활동인원: r.active_members,
                    활동율: r.activity_rate,
                    기간시작: r.start_date,
                    기간종료: r.end_date,
                }))
            );

            const sheet2 = XLSX.utils.json_to_sheet(
                allRegionTeamRows.map((r) => ({
                    구분: r.key,
                    지역: r.region,
                    팀: r.team,
                    구역: r.subteam,
                    전체인원: r.total_members,
                    활동인원: r.active_members,
                    활동율: r.activity_rate,
                    기간시작: r.start_date,
                    기간종료: r.end_date,
                }))
            );

            XLSX.utils.book_append_sheet(wb, sheet1, safeSheet('전체-지역활동율'));
            XLSX.utils.book_append_sheet(wb, sheet2, safeSheet('전체-지역팀활동율'));

            XLSX.writeFile(wb, `청년회_전체_${baseDate.format('YYYYMMDD')}.xlsx`);
            return;
        }

        if (tab === 'region') {
            const sheet = XLSX.utils.json_to_sheet(
                regionRows.map((r) => ({
                    구분: r.key,
                    지역: r.region,
                    팀: r.team,
                    구역: r.subteam,
                    전체인원: r.total_members,
                    활동인원: r.active_members,
                    활동율: r.activity_rate,
                    기간시작: r.start_date,
                    기간종료: r.end_date,
                }))
            );

            XLSX.utils.book_append_sheet(wb, sheet, safeSheet(`${selectedRegion}-활동율`));
            XLSX.writeFile(wb, `${selectedRegion}_활동율_${baseDate.format('YYYYMMDD')}.xlsx`);
            return;
        }

        if (tab === 'log') {
            setLoading(true);
            setError(null);

            try {
                const allLogs = await fetchAllLogsForExport();

                const sheet = XLSX.utils.json_to_sheet(
                    allLogs.map((r: LogRow) => ({
                        날짜: r.날짜,
                        지역: r.지역,
                        팀: r.팀,
                        이름: r.이름,
                        활동: r.활동,
                        메모: r.memo,
                        등록시각: r.created_at,
                        고유번호: r.고유번호,
                    }))
                );

                XLSX.utils.book_append_sheet(wb, sheet, safeSheet('활동로그'));
                XLSX.writeFile(wb, `활동로그_${logFrom.format('YYYYMMDD')}_${logTo.format('YYYYMMDD')}.xlsx`);
            } catch (e: any) {
                setError(e?.message ?? '엑셀 다운로드 실패');
            } finally {
                setLoading(false);
            }
            return;
        }

        if (tab === 'weekly-board') {
            const summarySheet = XLSX.utils.json_to_sheet(
                weeklyBoardRows.map((r) => ({
                    지역: r.region,
                    팀: r.team,
                    구역: r.subteam,
                    월: r.monday_count,
                    화: r.tuesday_count,
                    수: r.wednesday_count,
                    목: r.thursday_count,
                    금: r.friday_count,
                    토: r.saturday_count,
                    일: r.sunday_count,
                    주간활동자수: r.total_active_members,
                    보고한요일수: r.reported_days_count,
                    미보고요일: Array.isArray(r.missing_days) ? r.missing_days.join(', ') : '',
                    주시작: r.week_start,
                    주종료: r.week_end,
                }))
            );

            const missingOnlySheet = XLSX.utils.json_to_sheet(
                weeklyBoardRows
                    .filter((r) => Array.isArray(r.missing_days) && r.missing_days.length > 0)
                    .map((r) => ({
                        지역: r.region,
                        팀: r.team,
                        구역: r.subteam,
                        미보고요일: r.missing_days.join(', '),
                        보고한요일수: r.reported_days_count,
                        주시작: r.week_start,
                        주종료: r.week_end,
                    }))
            );

            XLSX.utils.book_append_sheet(wb, summarySheet, safeSheet('주간현황'));
            XLSX.utils.book_append_sheet(wb, missingOnlySheet, safeSheet('미보고요일'));
            XLSX.writeFile(wb, `주간현황_${baseDate.format('YYYYMMDD')}.xlsx`);
        }
    }, [
        tab,
        allRegionRows,
        allRegionTeamRows,
        regionRows,
        weeklyBoardRows,
        baseDate,
        selectedRegion,
        logFrom,
        logTo,
        fetchAllLogsForExport,
    ]);

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
                                disabled={tab === 'weekly-board'}
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

                        <Button
                            type="primary"
                            onClick={exportToExcel}
                            disabled={loading}
                        >
                            엑셀 다운로드
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

                        <Button
                            type="primary"
                            onClick={exportToExcel}
                            disabled={loading}
                        >
                            엑셀 다운로드
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
                            key: 'weekly-board',
                            label: '주간 현황',
                            children: (
                                <Spin spinning={loading}>
                                    <div className="space-y-4">
                                        <Alert
                                            type="info"
                                            showIcon
                                            message="기준일이 포함된 주간(월~일) 기준으로 지역/팀/구역별 활동자 수와 미보고 요일을 보여줍니다."
                                        />
                                        <Table
                                            rowKey={(r) => `weekly-${r.key}`}
                                            columns={weeklyBoardColumns as any}
                                            dataSource={weeklyBoardRows}
                                            pagination={false}
                                            size="middle"
                                            scroll={{ x: 1400 }}
                                        />
                                    </div>
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
