'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Table, Button, DatePicker, Select, Spin, message, Typography, Input, Alert, Modal } from 'antd';
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

export default function RegionWiseRemarks() {
    const queryClient = useQueryClient();

    const { isAdmin, isLoading: isUserLoading } = useUser();
    const { data: students = [], isLoading: isDataLoading } = useStudentsBQuery();

    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
    const [targets, setTargets] = useState<Record<number, { month?: string; date?: string; week?: string }>>({});
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

    /* =======================
       초기 target 세팅 (⭐ FIX)
    ======================= */
    useEffect(() => {
        if (initializedRef.current) return; // ✅ 한 번만
        if (!students || students.length === 0) return;

        const initial: Record<number, { month?: string; date?: string; week?: string }> = {};
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

            이전목표월: (s as any).prevTarget ?? '',
            현재목표월: targets[s.번호]?.month ?? s.target ?? '',
            목표변경횟수: (s as any).targetChangeCount ?? 0,

            실행일자: targets[s.번호]?.date ?? '',
            주횟수: targets[s.번호]?.week ?? '',
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
        { title: '단계', dataIndex: '단계', width: 60 },
        {
            title: '이름',
            dataIndex: '이름',
            width: 40 as any,
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
        { title: '인도자지역', dataIndex: '인도자지역', width: 60 },
        { title: '인도자팀', dataIndex: '인도자팀', width: 60 },
        { title: '인도자이름', dataIndex: '인도자이름', width: 60 },
        { title: '교사지역', dataIndex: '교사지역', width: 60 },
        { title: '교사팀', dataIndex: '교사팀', width: 60 },
        { title: '교사이름', dataIndex: '교사이름', width: 60 },

        {
            title: '이전목표',
            width: 80,
            render: (_, r) => (r as any).prevTarget ?? '-',
        },
        {
            title: '변경횟수',
            width: 80,
            align: 'center',
            render: (_, r) => (r as any).targetChangeCount ?? 0,
        },
        {
            title: '히스토리',
            width: 80,
            render: (_, r) => (
                <Button size="small" disabled={!(r as any).targetChangeCount} onClick={() => openHistoryModal(r)}>
                    보기
                </Button>
            ),
        },
        {
            title: '목표월',
            width: 90,
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
        {
            title: '실행일자',
            width: 110,
            render: (_, r) => (
                <DatePicker
                    value={targets[r.번호]?.date ? dayjs(targets[r.번호]?.date) : null}
                    onChange={(d) =>
                        setTargets((p) => ({
                            ...p,
                            [r.번호]: { ...(p[r.번호] ?? {}), date: d?.format('YYYY-MM-DD') },
                        }))
                    }
                />
            ),
        },
        {
            title: '주횟수',
            width: 110,
            render: (_, r) => (
                <Select
                    value={targets[r.번호]?.week ?? '미수강'}
                    onChange={(v) => setTargets((p) => ({ ...p, [r.번호]: { ...(p[r.번호] ?? {}), week: v } }))}
                    options={[
                        { value: '1회', label: '1회' },
                        { value: '2회', label: '2회' },
                        { value: '3회', label: '3회' },
                        { value: '4회이상', label: '4회이상' },
                        { value: '미수강', label: '미수강' },
                    ]}
                />
            ),
        },
    ];

    /* =======================
       저장 (⭐ 업데이트가 "안 보이는" 문제 해결)
    ======================= */
    const handleSave = async () => {
        if (saving) return;
        setSaving(true);

        try {
            const payload = Object.entries(targets).map(([id, v]) => ({
                번호: Number(id),
                month: v.month ?? null,
                date: v.date ?? null,
                week: v.week ?? null,
            }));

            const res = await fetch('/api/update-targets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targets: payload }),
            });

            const result = await res.json().catch(() => null);

            if (!res.ok) {
                // ✅ 서버 에러 메시지 그대로 표시
                message.error(result?.error || result?.message || '저장 실패');
                return;
            }

            message.success('저장되었습니다.');
            setSavedMessage(true);
            setTimeout(() => setSavedMessage(false), 2000);

            // ✅ 저장 후 React Query 재조회 → 화면에 즉시 반영
            await queryClient.invalidateQueries({ queryKey: ['students-b'] });

            // ✅ 새 데이터 기준으로 targets 다시 맞추기 (무한루프 방지용 리셋)
            initializedRef.current = false;
            setTargets({});
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

                    {/* 🔹 지역 선택 버튼 */}
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

                    {/* 🔹 검색 + 액션 */}
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

            {/* 🔹 히스토리 Modal */}
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
