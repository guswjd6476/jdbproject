'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Table, Button, Select, Spin, message, Typography, Input, Alert, Modal, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Students, useStudentsBQuery } from '@/app/hook/useStudentsBQuery';
import { useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { useUser } from '@/app/hook/useUser';
import Link from 'next/link';

const { Option } = Select;
const { Text } = Typography;
const { Search } = Input;

type TargetValue = { month?: string; date?: string; week?: string };

export default function RegionWiseRemarks() {
    const queryClient = useQueryClient();

    const { isAdmin, isLoading: isUserLoading } = useUser();
    const { data: students = [], isLoading: isDataLoading } = useStudentsBQuery();

    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
    const [targets, setTargets] = useState<Record<number, TargetValue>>({});
    const [visibleId, setVisibleId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [savedMessage, setSavedMessage] = useState(false);
    const [searchText, setSearchText] = useState('');

    // 히스토리 모달
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<Students | null>(null);

    // ✅ targets 초기화 1회만 (무한루프 방지)
    const initializedRef = useRef(false);

    // ⭐ 초기값 저장용 ref (변경된 row만 저장하기 위해 필요)
    const initialTargetsRef = useRef<Record<number, TargetValue>>({});

    /* =======================
       초기 target 세팅
    ======================= */
    useEffect(() => {
        if (initializedRef.current) return;
        if (!students || students.length === 0) return;

        const initial: Record<number, TargetValue> = {};
        students.forEach((s) => {
            if (typeof s.번호 === 'number') {
                initial[s.번호] = {
                    month: s.target ?? undefined,
                    date: s.trydate ?? undefined,
                    week: s.numberofweek ?? undefined,
                };
            }
        });

        setTargets(initial);

        // ⭐ 최초 기준값 저장
        initialTargetsRef.current = initial;

        initializedRef.current = true;
    }, [students]);

    /* =======================
       지역 목록
    ======================= */
    const allRegions = useMemo(() => {
        const set = new Set<string>();
        students.forEach((s) => {
            if (s.인도자지역) set.add(String(s.인도자지역));
            if (s.교사지역) set.add(String(s.교사지역));
        });
        return Array.from(set).sort();
    }, [students]);

    /* =======================
       필터링 (지역 + 검색)
    ======================= */
    const filtered = useMemo(() => {
        return students.filter((s) => {
            const matchRegion =
                !selectedRegion ||
                String(s.인도자지역 ?? '') === selectedRegion ||
                String(s.교사지역 ?? '') === selectedRegion;

            const matchSearch = !searchText || (s.이름?.includes(searchText) ?? false);
            return matchRegion && matchSearch;
        });
    }, [students, selectedRegion, searchText]);

    /* =======================
       목표 월 옵션
    ======================= */
    const currentMonth = dayjs().month();
    const monthOptions = useMemo(() => {
        const arr: string[] = [];
        for (let i = 0; i < 3; i++) arr.push(`${((currentMonth + i) % 12) + 1}월`);
        arr.push('장기');
        return arr;
    }, [currentMonth]);

    /* =======================
       히스토리 모달 열기
    ======================= */
    const openHistoryModal = async (record: Students) => {
        setSelectedStudent(record);
        setHistoryOpen(true);
        setHistoryLoading(true);
        try {
            const res = await fetch(`/api/students/target-history?studentId=${record.번호}`);
            const json = await res.json();
            setHistoryData(json.history || []);
        } catch {
            message.error('히스토리 조회 실패');
        } finally {
            setHistoryLoading(false);
        }
    };

    /* =======================
       신규/잔존 구분 로직
    ======================= */
    const getStatus = (r: Students): '신규' | '잔존' | '' => {
        const cnt = Number((r as any).targetChangeCount ?? 0);
        if (cnt === 0) return '신규';

        const prevTarget = String((r as any).prevTarget ?? '').trim();
        const currentTarget = String(targets[r.번호]?.month ?? r.target ?? '').trim();
        if (!prevTarget || !currentTarget) return '';

        const parseMonth = (v: string) => {
            const m = v.match(/(\d+)\s*월/);
            return m ? Number(m[1]) : null;
        };

        const prevMonth = parseMonth(prevTarget);
        const currMonth = parseMonth(currentTarget);
        if (!prevMonth || !currMonth) return '';

        const lastMonth = dayjs().subtract(1, 'month').month() + 1;
        const thisMonth = dayjs().month() + 1;

        if (prevMonth === lastMonth && currMonth === thisMonth) return '잔존';
        return '';
    };

    /* =======================
       엑셀 다운로드
    ======================= */
    const handleExportExcel = () => {
        const exportData = filtered.map((s) => ({
            단계: s.단계,
            이름: s.이름,

            인도자지역: s.인도자지역 ?? '',
            인도자팀: s.인도자팀 ?? '',
            인도자이름: s.인도자이름 ?? '',

            교사지역: s.교사지역 ?? '',
            교사팀: s.교사팀 ?? '',
            교사이름: s.교사이름 ?? '',

            구분: getStatus(s),
            이전목표월: (s as any).prevTarget ?? '',
            현재목표월: targets[s.번호]?.month ?? s.target ?? '',
            목표변경횟수: (s as any).targetChangeCount ?? 0,
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '특이사항목록');

        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        saveAs(blob, `특이사항목록_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`);
    };

    /* =======================
       테이블 컬럼
    ======================= */
    const columns: ColumnsType<Students> = [
        { title: '단계', dataIndex: '단계', width: 30 },

        {
            title: '이름',
            dataIndex: '이름',
            width: 40,
            sorter: (a, b) => String(a.이름 ?? '').localeCompare(String(b.이름 ?? ''), 'ko'),
            sortDirections: ['ascend', 'descend'],
            render: (name: string, r) => {
                const visible = visibleId === r.번호;
                const masked =
                    name.length <= 2 ? name[0] + 'O' : name[0] + 'O'.repeat(name.length - 2) + name[name.length - 1];
                return (
                    <span style={{ cursor: 'pointer' }} onClick={() => setVisibleId(visible ? null : r.번호)}>
                        {visible ? name : masked}
                    </span>
                );
            },
        },

        { title: '인도지역', dataIndex: '인도자지역', width: 50 },
        { title: '인도자팀', dataIndex: '인도자팀', width: 30 },
        { title: '인도이름', dataIndex: '인도자이름', width: 50 },
        { title: '교사지역', dataIndex: '교사지역', width: 50 },
        { title: '교사팀', dataIndex: '교사팀', width: 30 },
        { title: '교사이름', dataIndex: '교사이름', width: 50 },

        { title: '이전목표', width: 50, render: (_, r) => (r as any).prevTarget ?? '-' },

        {
            title: '변경횟수',
            width: 40,
            align: 'center',
            sorter: (a, b) => Number((a as any).targetChangeCount ?? 0) - Number((b as any).targetChangeCount ?? 0),
            sortDirections: ['descend', 'ascend'],
            defaultSortOrder: 'descend',
            render: (_, r) => (r as any).targetChangeCount ?? 0,
        },

        {
            title: '구분',
            width: 40,
            align: 'center',
            filters: [
                { text: '신규', value: '신규' },
                { text: '잔존', value: '잔존' },
            ],
            onFilter: (value, record) => getStatus(record) === value,
            render: (_, r) => {
                const status = getStatus(r);
                if (!status) return '-';
                return status === '신규' ? <Tag color="blue">신규</Tag> : <Tag color="gold">잔존</Tag>;
            },
        },

        {
            title: '히스토리',
            width: 30,
            render: (_, r) => (
                <Button size="small" disabled={!(r as any).targetChangeCount} onClick={() => openHistoryModal(r)}>
                    보기
                </Button>
            ),
        },

        {
            title: '목표월',
            width: 20,
            sorter: (a, b) => {
                const am = targets[a.번호]?.month ?? a.target ?? '';
                const bm = targets[b.번호]?.month ?? b.target ?? '';
                return String(am).localeCompare(String(bm), 'ko');
            },
            sortDirections: ['ascend', 'descend'],
            render: (_, r) => (
                <Select
                    value={targets[r.번호]?.month}
                    onChange={(v) => setTargets((p) => ({ ...p, [r.번호]: { ...(p[r.번호] ?? {}), month: v } }))}
                    allowClear
                    style={{ width: '100%' }}
                >
                    {monthOptions.map((m) => (
                        <Option key={m} value={m}>
                            {m}
                        </Option>
                    ))}
                </Select>
            ),
        },
    ];

    /* =======================
       ✅ 저장 (수정된 row만 보내도록 개선)
    ======================= */
    const handleSave = async () => {
        if (saving) return;
        setSaving(true);

        try {
            // ⭐ 변경된 학생만 필터링
            const payload = Object.entries(targets)
                .filter(([id, cur]) => {
                    const studentId = Number(id);
                    const prev = initialTargetsRef.current?.[studentId];

                    // prev가 없으면(안전장치) 업데이트 대상으로 취급
                    if (!prev) return true;

                    const prevMonth = prev.month ?? null;
                    const prevDate = prev.date ?? null;
                    const prevWeek = prev.week ?? null;

                    const curMonth = cur.month ?? null;
                    const curDate = cur.date ?? null;
                    const curWeek = cur.week ?? null;

                    return prevMonth !== curMonth || prevDate !== curDate || prevWeek !== curWeek;
                })
                .map(([id, v]) => ({
                    번호: Number(id),
                    month: v.month ?? null,
                    date: v.date ?? null,
                    week: v.week ?? null,
                }));

            // ⭐ 아무것도 바뀐 게 없으면 서버 호출 안함
            if (payload.length === 0) {
                message.info('변경된 내용이 없습니다.');
                return;
            }

            const res = await fetch('/api/update-targets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targets: payload }),
            });

            const result = await res.json().catch(() => null);

            if (!res.ok) {
                message.error(result?.error || result?.message || '저장 실패');
                return;
            }

            message.success(`저장되었습니다. (변경 ${payload.length}명)`);
            setSavedMessage(true);
            setTimeout(() => setSavedMessage(false), 2000);

            await queryClient.invalidateQueries({ queryKey: ['students-b'] });

            // ⭐ 저장 성공 후: 현재 상태를 초기 기준값으로 업데이트
            initialTargetsRef.current = { ...targets };
        } catch (e: any) {
            message.error(e?.message || '저장 중 오류');
        } finally {
            setSaving(false);
        }
    };

    /* =======================
       접근 제어
    ======================= */
    if (isUserLoading) {
        return (
            <div className="h-[80vh] flex items-center justify-center">
                <Spin size="large" />
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="p-10 text-center">
                <Alert message="접근 권한 없음" type="error" showIcon />
                <Link href="/student/view">
                    <Button type="primary" className="mt-4">
                        돌아가기
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <>
            <Spin spinning={isDataLoading || saving}>
                <div className="p-6">
                    <h2 className="text-xl font-bold mb-4">지역별 합등 이상 특이사항 관리</h2>

                    <div className="flex flex-wrap gap-2 mb-3">
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

                    <div className="flex gap-3 mb-3">
                        <Search
                            placeholder="이름 검색"
                            allowClear
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            style={{ width: 200 }}
                        />
                        <Button onClick={handleExportExcel}>엑셀 다운로드</Button>
                        <Button type="primary" onClick={handleSave} disabled={saving}>
                            저장
                        </Button>
                        {savedMessage && <Text type="success">✅ 저장 완료</Text>}
                    </div>

                    <Table
                        dataSource={filtered}
                        rowKey="번호"
                        columns={columns}
                        pagination={{ pageSize: 50 }}
                        scroll={{ x: 1400 }}
                    />
                </div>
            </Spin>

            <Modal
                open={historyOpen}
                title={`${selectedStudent?.이름} 목표 변경 이력`}
                footer={null}
                onCancel={() => setHistoryOpen(false)}
                width={500}
            >
                <Spin spinning={historyLoading}>
                    <Table
                        dataSource={historyData}
                        rowKey="change_count"
                        pagination={false}
                        size="small"
                        columns={[
                            { title: '회차', dataIndex: 'change_count', width: 60 },
                            { title: '목표월', dataIndex: 'target', width: 100 },
                            {
                                title: '변경일',
                                dataIndex: 'created_at',
                                render: (v) => dayjs(v).format('YYYY-MM-DD'),
                            },
                        ]}
                    />
                </Spin>
            </Modal>
        </>
    );
}
