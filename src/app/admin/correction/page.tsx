'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Table, Input, Button, DatePicker, Popconfirm, message, Select, Space, Spin, Alert } from 'antd';
import type { ColumnsType, ColumnType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { useUser } from '@/app/hook/useUser';
import Link from 'next/link'; // 1. Link 컴포넌트 임포트

const COMPLETION_FIELDS = [
    '발_완료일',
    '찾_완료일',
    '합_완료일',
    '섭_완료일',
    '복_완료일',
    '예정_완료일',
    '센확_완료일',
    '탈락',
] as const;

const STAGE_OPTIONS = [
    '발',
    '찾',
    '합',
    '섭',
    '복',
    '예정',
    '탈락',
    ...Array.from({ length: 3 }, (_, i) => {
        const date = dayjs().add(i - 1, 'month');
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
    target?: string;
    [key: string]: string | number | undefined;
};

export default function AdminStudentManager() {
    // 2. useUser 훅에서 role과 isLoading 상태를 가져옵니다.
    const { role, isLoading: isUserLoading } = useUser();

    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingDates, setEditingDates] = useState<Partial<Record<string, Dayjs | null>>>({});
    const [editingStages, setEditingStages] = useState<Partial<Record<number, string>>>({});
    const [editingNames, setEditingNames] = useState<Partial<Record<number, string>>>({});
    const [searchName, setSearchName] = useState('');
    const [searchStage, setSearchStage] = useState<string | null>(null);
    const [filteredKeyword, setFilteredKeyword] = useState({ name: '', stage: '' });
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [bulkStage, setBulkStage] = useState<string | null>(null);
    const [bulkDateField, setBulkDateField] = useState<string | null>(null);
    const [bulkDate, setBulkDate] = useState<Dayjs | null>(null);

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
        // 3. 최고 관리자일 때만 데이터를 불러오도록 조건을 추가합니다.
        if (role === 'superAdmin') {
            fetchStudents();
        }
    }, [role]); // role이 확정된 후에 fetch를 실행합니다.

    const handleEdit = (record: Student) => {
        setEditingId(record.id);
        setEditingStages((prev) => ({ ...prev, [record.id]: record.단계 ?? '' }));
        setEditingNames((prev) => ({ ...prev, [record.id]: record.이름 ?? '' }));
        const newDates: Partial<Record<string, Dayjs | null>> = {};
        COMPLETION_FIELDS.forEach((field) => {
            newDates[field] = record[field] ? dayjs(record[field]) : null;
        });
        setEditingDates(newDates);
    };

    const handleDateChange = (field: string, date: Dayjs | null) => {
        setEditingDates((prev) => ({ ...prev, [field]: date }));
    };

    const handleStageChange = (id: number, value: string) => {
        setEditingStages((prev) => ({ ...prev, [id]: value }));
    };

    const handleSave = async (번호: number) => {
        try {
            const payload: Record<string, string | null> = {};
            for (const key of COMPLETION_FIELDS) {
                payload[key] = editingDates[key]?.format('YYYY-MM-DD') ?? null;
            }
            payload['단계'] = editingStages[번호] ?? null;
            payload['이름'] = editingNames[번호] ?? null;

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

    const rowSelection = {
        selectedRowKeys,
        onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
    };

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

    const targetMonthFilters = useMemo(() => {
        const uniqueTargets = [
            ...new Set(students.map((s) => s.target).filter((target): target is string => !!target)),
        ];
        return uniqueTargets.sort((a, b) => a.localeCompare(b)).map((target) => ({ text: target, value: target }));
    }, [students]);

    const columns: ColumnsType<Student> = [
        { title: 'id', dataIndex: 'id', key: 'id', width: 50, fixed: 'left' },
        {
            title: '단계',
            dataIndex: '단계',
            key: '단계',
            fixed: 'left',
            width: 70,
            sorter: (a, b) => (a.단계 || '').localeCompare(b.단계 || '', 'ko'),
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
        {
            title: '이름',
            dataIndex: '이름',
            key: '이름',
            width: 70,
            fixed: 'left',
            render: (value: string | undefined, record: Student) => {
                const isEditing = editingId === record.id;
                if (!isEditing) return value || '';
                return (
                    <Input
                        value={editingNames[record.id] ?? value ?? ''}
                        onChange={(e) => setEditingNames((prev) => ({ ...prev, [record.id]: e.target.value }))}
                        size="small"
                        style={{ width: 90 }}
                    />
                );
            },
        },
        { title: '연락처', dataIndex: '연락처', key: '연락처', width: 60 },
        { title: '인도자지역', dataIndex: '인도자지역', key: '인도자지역', width: 40 },
        { title: '인도자팀', dataIndex: '인도자팀', key: '인도자팀', width: 40 },
        { title: '인도자이름', dataIndex: '인도자이름', key: '인도자이름', width: 70 },
        { title: '교사지역', dataIndex: '교사지역', key: '교사지역', width: 40 },
        { title: '교사팀', dataIndex: '교사팀', key: '교사팀', width: 40 },
        { title: '교사이름', dataIndex: '교사이름', key: '교사이름', width: 70 },
        ...COMPLETION_FIELDS.map(
            (key): ColumnType<Student> => ({
                title: key.replace('_완료일', '').toUpperCase(),
                dataIndex: key,
                key,
                width: 70,
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
            })
        ),
        {
            title: '목표월',
            dataIndex: 'target',
            key: 'target',
            width: 70,
            sorter: (a, b) => (a.target || '').localeCompare(b.target || ''),
            filters: targetMonthFilters,
            onFilter: (value, record) => record.target === value,
        },
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

    // 4. 렌더링 게이트: 사용자 인증 정보를 불러오는 동안 로딩 화면을 표시합니다.
    if (isUserLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <Spin size="large" />
            </div>
        );
    }

    // 5. 렌더링 게이트: 로딩이 끝난 후, 최고 관리자가 아닐 경우 접근 거부 메시지를 표시합니다.
    if (role !== 'superAdmin') {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <Alert
                    message="접근 권한 없음"
                    description="최고 관리자만 이 페이지에 접근할 수 있습니다."
                    type="error"
                    showIcon
                />
                <Link href="/student/view">
                    <Button type="primary" style={{ marginTop: '20px' }}>
                        수강생 조회 페이지로 돌아가기
                    </Button>
                </Link>
            </div>
        );
    }

    // 6. 위 두 조건을 모두 통과한 경우(로딩이 끝났고, 최고 관리자인 경우)에만 실제 페이지 내용을 렌더링합니다.
    return (
        <div className="p-4">
            <h2 className="text-2xl font-bold mb-4">관리자 학생 관리</h2>
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
