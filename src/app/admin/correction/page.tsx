'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Table, Input, Button, DatePicker, Popconfirm, message, Select, Space, Spin } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { useUser } from '@/app/hook/useUser';

const COMPLETION_FIELDS = [
    'a_완료일',
    'b_완료일',
    'c_완료일',
    'd_1_완료일',
    'd_2_완료일',
    'e_완료일',
    'f_완료일',
    '센확_완료일',
    '탈락',
] as const;

const STAGE_OPTIONS = [
    'A',
    'B',
    'C',
    'D-1',
    'D-2',
    'E',
    'F',
    '탈락',
    ...Array.from({ length: 3 }, (_, i) => {
        const date = dayjs().add(i - 1, 'month'); // -1,0,+1개월
        return `${date.year()}년 ${date.month() + 1}월센등`;
    }),
    '센확',
];

type Student = {
    id: number;
    번호: number;
    이름: string;
    연락처?: string;
    생년월일?: string;
    인도자_고유번호?: string;
    교사_고유번호?: string;
    단계?: string;
    [key: string]: string | number | undefined;
};

export default function AdminStudentManager() {
    const { user } = useUser();
    const isAdmin = user === 'all';

    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingDates, setEditingDates] = useState<Partial<Record<string, Dayjs | null>>>({});
    const [editingStages, setEditingStages] = useState<Partial<Record<number, string>>>({});

    const [searchName, setSearchName] = useState('');
    const [searchStage, setSearchStage] = useState<string | null>(null);
    const [filteredKeyword, setFilteredKeyword] = useState({ name: '', stage: '' });

    // === 일괄 변경 관련 상태 ===
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [bulkStage, setBulkStage] = useState<string | null>(null);
    const [bulkDateField, setBulkDateField] = useState<string | null>(null);
    const [bulkDate, setBulkDate] = useState<Dayjs | null>(null);

    // 학생 데이터 불러오기
    const fetchStudents = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/students/admin');
            const data = await res.json();
            setStudents(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
            message.error('데이터를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStudents();
    }, []);

    // 단일 수정: 수정 시작
    const handleEdit = (record: Student) => {
        setEditingId(record.id);
        setEditingStages((prev) => ({ ...prev, [record.id]: record.단계 ?? '' }));

        const newDates: Partial<Record<string, Dayjs | null>> = {};
        COMPLETION_FIELDS.forEach((field) => {
            newDates[field] = record[field] ? dayjs(record[field]) : null;
        });
        setEditingDates(newDates);
    };

    // 단일 수정: 날짜 변경
    const handleDateChange = (field: string, date: Dayjs | null) => {
        setEditingDates((prev) => ({ ...prev, [field]: date }));
    };

    // 단일 수정: 단계 변경
    const handleStageChange = (id: number, value: string) => {
        setEditingStages((prev) => ({ ...prev, [id]: value }));
    };

    // 단일 수정: 저장
    const handleSave = async (번호: number) => {
        try {
            const payload: Record<string, string | null> = {};
            for (const key of COMPLETION_FIELDS) {
                payload[key] = editingDates[key]?.format('YYYY-MM-DD') ?? null;
            }
            payload['단계'] = editingStages[번호] ?? null;

            const res = await fetch(`/api/students/update-date`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 번호, ...payload }),
            });

            if (!res.ok) throw new Error();
            message.success('저장 완료');
            setEditingId(null);
            fetchStudents();
        } catch {
            message.error('저장 실패');
        }
    };

    // 단일 삭제
    const handleDelete = async (id: number) => {
        try {
            const res = await fetch('/api/students/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            if (!res.ok) throw new Error();
            message.success('삭제 완료');
            fetchStudents();
        } catch {
            message.error('삭제 실패');
        }
    };

    // 필터링
    const filteredStudents = useMemo(() => {
        return students.filter((student) => {
            const nameMatch = filteredKeyword.name
                ? student.이름?.toLowerCase().includes(filteredKeyword.name.toLowerCase())
                : true;
            const stageMatch = filteredKeyword.stage ? student.단계 === filteredKeyword.stage : true;
            return nameMatch && stageMatch;
        });
    }, [students, filteredKeyword]);

    const handleSearch = () => {
        setFilteredKeyword({
            name: searchName,
            stage: searchStage ?? '',
        });
    };

    // === 체크박스 선택 변경 ===
    const rowSelection = {
        selectedRowKeys,
        onChange: (keys: React.Key[]) => {
            setSelectedRowKeys(keys);
        },
    };

    // === 일괄 저장 핸들러 ===
    const handleBulkSave = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning('변경할 학생을 선택하세요.');
            return;
        }
        if (!bulkStage && !bulkDateField) {
            message.warning('변경할 단계 또는 완료일을 선택하세요.');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                ids: selectedRowKeys,
                단계: bulkStage ?? undefined,
                완료일필드: bulkDateField ?? undefined,
                완료일: bulkDate ? bulkDate.format('YYYY-MM-DD') : undefined,
            };

            const res = await fetch('/api/students/bulk-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error();

            message.success('일괄 저장 완료');
            setSelectedRowKeys([]);
            setBulkStage(null);
            setBulkDateField(null);
            setBulkDate(null);
            fetchStudents();
        } catch (err) {
            console.error(err);
            message.error('일괄 저장 실패');
        } finally {
            setLoading(false);
        }
    };

    const columns: ColumnsType<Student> = [
        { title: 'id', dataIndex: 'id', key: 'id', width: 70, fixed: 'left' },
        {
            title: '단계',
            dataIndex: '단계',
            key: '단계',
            fixed: 'left',
            width: 160,
            sorter: (a, b) => {
                const valA = a.단계 || '';
                const valB = b.단계 || '';
                return valA.localeCompare(valB, 'ko');
            },
            render: (value: string | undefined, record: Student) => {
                const isEditing = editingId === record.id;
                if (!isEditing) return value || '';
                return (
                    <Select
                        value={editingStages[record.id] ?? value ?? ''}
                        onChange={(val) => handleStageChange(record.id, val)}
                        style={{ width: 150 }}
                        options={STAGE_OPTIONS.map((stage) => ({ label: stage, value: stage }))}
                        showSearch
                        optionFilterProp="label"
                    />
                );
            },
        },
        { title: '이름', dataIndex: '이름', key: '이름', width: 100, fixed: 'left' },
        { title: '연락처', dataIndex: '연락처', key: '연락처', width: 120 },
        ...COMPLETION_FIELDS.map((key) => ({
            title: key.replace('_완료일', '').toUpperCase(),
            dataIndex: key,
            key,
            width: 150,
            render: (value: string | null, record: Student) => {
                const isEditing = editingId === record.id;
                if (!isEditing) {
                    return value ? dayjs(value).format('YYYY.MM.DD') : '';
                }
                return (
                    <DatePicker
                        value={editingDates[key] ?? null}
                        onChange={(date) => handleDateChange(key, date)}
                        format="YYYY.MM.DD"
                        size="small"
                        allowClear
                    />
                );
            },
        })),
        {
            title: '관리',
            key: 'actions',
            width: 180,
            render: (_: unknown, record: Student) => {
                const isEditing = editingId === record.id;
                return isEditing ? (
                    <Space>
                        <Button size="small" type="primary" onClick={() => handleSave(record.id)}>
                            저장
                        </Button>
                        <Button size="small" onClick={() => setEditingId(null)}>
                            취소
                        </Button>
                    </Space>
                ) : (
                    <Space>
                        <Button size="small" onClick={() => handleEdit(record)}>
                            수정
                        </Button>
                        <Popconfirm
                            title="삭제하시겠습니까?"
                            onConfirm={() => handleDelete(record.id)}
                            okText="삭제"
                            cancelText="취소"
                        >
                            <Button danger size="small">
                                삭제
                            </Button>
                        </Popconfirm>
                    </Space>
                );
            },
        },
    ];

    if (!isAdmin) {
        return <div className="p-4 text-red-600 font-bold">관리자 전용 페이지입니다.</div>;
    }

    return (
        <div className="p-4">
            <h2 className="text-2xl font-bold mb-4">관리자 학생 관리</h2>

            {/* 검색 필터 */}
            <div className="mb-4 flex gap-2">
                <Input
                    placeholder="이름"
                    allowClear
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    onPressEnter={handleSearch}
                    style={{ width: 200 }}
                />
                <Select
                    placeholder="단계"
                    allowClear
                    style={{ width: 200 }}
                    value={searchStage}
                    onChange={(value) => setSearchStage(value)}
                    options={STAGE_OPTIONS.map((stage) => ({ label: stage, value: stage }))}
                    showSearch
                    optionFilterProp="label"
                />
                <Button type="primary" onClick={handleSearch}>
                    검색
                </Button>
            </div>

            {/* 일괄 변경 UI */}
            <Space align="center" wrap className="mb-4">
                <Select
                    placeholder="일괄 단계 선택"
                    style={{ width: 150 }}
                    value={bulkStage}
                    onChange={setBulkStage}
                    options={STAGE_OPTIONS.map((stage) => ({ label: stage, value: stage }))}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                />
                <Select
                    placeholder="일괄 완료일 필드 선택"
                    style={{ width: 150 }}
                    value={bulkDateField}
                    onChange={setBulkDateField}
                    options={COMPLETION_FIELDS.map((field) => ({
                        label: field.replace('_완료일', '').toUpperCase(),
                        value: field,
                    }))}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                />
                <DatePicker value={bulkDate} onChange={setBulkDate} format="YYYY.MM.DD" allowClear />
                <Button
                    type="primary"
                    disabled={selectedRowKeys.length === 0 || (!bulkStage && !bulkDateField)}
                    onClick={handleBulkSave}
                    loading={loading}
                >
                    일괄 저장
                </Button>
            </Space>

            {/* 학생 테이블 */}
            <Table
                rowSelection={rowSelection}
                dataSource={filteredStudents}
                columns={columns}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 50 }}
                scroll={{ x: 1600 }}
                size="middle"
            />
        </div>
    );
}
