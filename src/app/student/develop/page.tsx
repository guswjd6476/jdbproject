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

    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<Students | null>(null);

    const initializedRef = useRef(false);
    const initialTargetsRef = useRef<Record<number, TargetValue>>({});

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
        initialTargetsRef.current = initial;
        initializedRef.current = true;
    }, [students]);

    // 공통 정렬 로직 (문자열)
    const stringSorter = (key: keyof Students) => (a: Students, b: Students) =>
        String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'ko');

    // 공통 필터 생성기
    const getUniqueFilters = (key: keyof Students) => {
        const uniqueValues = Array.from(
            new Set(students.map((s) => String(s[key] ?? '')).filter((v) => v.trim() !== ''))
        );
        return uniqueValues.map((v) => ({ text: v, value: v }));
    };

    const columns: ColumnsType<Students> = [
        {
            title: '단계',
            dataIndex: '단계',
            width: 70,
            sorter: stringSorter('단계'),
            filters: getUniqueFilters('단계'),
            onFilter: (value, record) => record.단계 === value,
        },
        {
            title: '이름',
            dataIndex: '이름',
            width: 90,
            sorter: stringSorter('이름'),
            render: (name: string, r) => {
                const visible = visibleId === r.번호;
                const masked =
                    name.length <= 2 ? name[0] + 'O' : name[0] + 'O'.repeat(name.length - 2) + name[name.length - 1];
                return (
                    <span
                        style={{ cursor: 'pointer', fontWeight: visible ? 'bold' : 'normal' }}
                        onClick={() => setVisibleId(visible ? null : r.번호)}
                    >
                        {visible ? name : masked}
                    </span>
                );
            },
        },
        {
            title: '인도지역',
            dataIndex: '인도자지역',
            width: 90,
            sorter: stringSorter('인도자지역'),
            filters: getUniqueFilters('인도자지역'),
            filterSearch: true,
            onFilter: (value, record) => String(record.인도자지역) === value,
        },
        {
            title: '인도자팀',
            dataIndex: '인도자팀',
            width: 80,
            sorter: stringSorter('인도자팀'),
            filters: getUniqueFilters('인도자팀'),
            onFilter: (value, record) => String(record.인도자팀) === value,
        },
        {
            title: '인도이름',
            dataIndex: '인도자이름',
            width: 90,
            sorter: stringSorter('인도자이름'),
            filterSearch: true,
            filters: getUniqueFilters('인도자이름'),
            onFilter: (value, record) => String(record.인도자이름) === value,
        },
        {
            title: '교사지역',
            dataIndex: '교사지역',
            width: 90,
            sorter: stringSorter('교사지역'),
            filters: getUniqueFilters('교사지역'),
            onFilter: (value, record) => String(record.교사지역) === value,
        },
        {
            title: '교사팀',
            dataIndex: '교사팀',
            width: 80,
            sorter: stringSorter('교사팀'),
            filters: getUniqueFilters('교사팀'),
            onFilter: (value, record) => String(record.교사팀) === value,
        },
        {
            title: '교사이름',
            dataIndex: '교사이름',
            width: 90,
            sorter: stringSorter('교사이름'),
            filters: getUniqueFilters('교사이름'),
            onFilter: (value, record) => String(record.교사이름) === value,
        },
        {
            title: '이전목표',
            width: 90,
            render: (_, r) => (r as any).prevTarget ?? '-',
            sorter: (a, b) =>
                String((a as any).prevTarget ?? '').localeCompare(String((b as any).prevTarget ?? ''), 'ko'),
        },
        {
            title: '변경횟수',
            width: 90,
            align: 'center',
            sorter: (a, b) => Number((a as any).targetChangeCount ?? 0) - Number((b as any).targetChangeCount ?? 0),
            render: (_, r) => (r as any).targetChangeCount ?? 0,
        },
        {
            title: '구분',
            width: 80,
            align: 'center',
            filters: [
                { text: '신규', value: '신규' },
                { text: '잔존', value: '잔존' },
                { text: '-', value: '-' },
            ],
            onFilter: (value, record) => (getStatus(record) || '-') === value,
            render: (_, r) => {
                const status = getStatus(r);
                if (!status) return '-';
                return status === '신규' ? <Tag color="blue">신규</Tag> : <Tag color="gold">잔존</Tag>;
            },
        },
        {
            title: '히스토리',
            width: 80,
            align: 'center',
            render: (_, r) => (
                <Button
                    size="small"
                    disabled={!(r as any).targetChangeCount}
                    onClick={() => openHistoryModal(r)}
                >
                    보기
                </Button>
            ),
        },
        {
            title: '목표월',
            width: 120,
            sorter: (a, b) => {
                const am = targets[a.번호]?.month ?? a.target ?? '';
                const bm = targets[b.번호]?.month ?? b.target ?? '';
                return String(am).localeCompare(String(bm), 'ko');
            },
            render: (_, r) => (
                <Select
                    value={targets[r.번호]?.month}
                    onChange={(v) => setTargets((p) => ({ ...p, [r.번호]: { ...(p[r.번호] ?? {}), month: v } }))}
                    allowClear
                    style={{ width: '100%' }}
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
    ];

    const currentMonth = dayjs().month();
    const monthOptions = useMemo(() => {
        const arr: string[] = [];
        for (let i = 0; i < 3; i++) arr.push(`${((currentMonth + i) % 12) + 1}월`);
        arr.push('장기');
        return arr;
    }, [currentMonth]);

    const filteredData = useMemo(() => {
        return students.filter((s) => {
            const matchRegion =
                !selectedRegion ||
                String(s.인도자지역 ?? '') === selectedRegion ||
                String(s.교사지역 ?? '') === selectedRegion;
            const matchSearch = !searchText || (s.이름?.toLowerCase().includes(searchText.toLowerCase()) ?? false);
            return matchRegion && matchSearch;
        });
    }, [students, selectedRegion, searchText]);

    const allRegions = useMemo(() => {
        const set = new Set<string>();
        students.forEach((s) => {
            if (s.인도자지역) set.add(String(s.인도자지역));
            if (s.교사지역) set.add(String(s.교사지역));
        });
        return Array.from(set).sort();
    }, [students]);

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

    const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        try {
            const payload = Object.entries(targets)
                .filter(([id, cur]) => {
                    const studentId = Number(id);
                    const prev = initialTargetsRef.current?.[studentId];
                    if (!prev) return true;
                    return prev.month !== cur.month || prev.date !== cur.date || prev.week !== cur.week;
                })
                .map(([id, v]) => ({
                    번호: Number(id),
                    month: v.month ?? null,
                    date: v.date ?? null,
                    week: v.week ?? null,
                }));

            if (payload.length === 0) {
                message.info('변경된 내용이 없습니다.');
                return;
            }

            const res = await fetch('/api/update-targets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targets: payload }),
            });

            if (!res.ok) throw new Error('저장 실패');
            message.success(`저장되었습니다. (변경 ${payload.length}명)`);
            await queryClient.invalidateQueries({ queryKey: ['students-b'] });
            initialTargetsRef.current = { ...targets };
        } catch (e: any) {
            message.error(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleExportExcel = () => {
        const exportData = filteredData.map((s) => ({
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
        saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `특이사항_${dayjs().format('YYYYMMDD')}.xlsx`);
    };

    if (isUserLoading)
        return (
            <div className="h-screen flex items-center justify-center">
                <Spin size="large" />
            </div>
        );
    if (!isAdmin)
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
                        className="mt-4"
                    >
                        돌아가기
                    </Button>
                </Link>
            </div>
        );

    return (
        <div className="p-6">
            <h2 className="text-xl font-bold mb-4">지역별 합등 이상 특이사항 관리</h2>
            <div className="flex flex-wrap gap-2 mb-4">
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
            <div className="flex justify-between items-center mb-4">
                <div className="flex gap-2">
                    <Search
                        placeholder="이름 검색"
                        allowClear
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        style={{ width: 200 }}
                    />
                    <Button onClick={handleExportExcel}>엑셀 다운로드</Button>
                </div>
                <div className="flex gap-2 items-center">
                    <Button
                        type="primary"
                        onClick={handleSave}
                        loading={saving}
                    >
                        저장하기
                    </Button>
                </div>
            </div>
            <Table
                dataSource={filteredData}
                columns={columns}
                rowKey="번호"
                loading={isDataLoading}
                pagination={{ pageSize: 50, showSizeChanger: true }}
                scroll={{ x: 1300, y: 'calc(100vh - 350px)' }}
                bordered
                size="small"
            />
            <Modal
                open={historyOpen}
                title={`${selectedStudent?.이름} 목표 변경 이력`}
                footer={null}
                onCancel={() => setHistoryOpen(false)}
            >
                <Table
                    dataSource={historyData}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    columns={[
                        { title: '회차', dataIndex: 'change_count' },
                        { title: '목표월', dataIndex: 'target' },
                        {
                            title: '변경일',
                            dataIndex: 'created_at',
                            render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm'),
                        },
                    ]}
                />
            </Modal>
        </div>
    );
}
