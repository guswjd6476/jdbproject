'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Table, Input, Button, DatePicker, Popconfirm, message, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { useUser } from '@/app/hook/useUser';

const { Search } = Input;

const COMPLETION_FIELDS = [
    'a_완료일',
    'b_완료일',
    'c_완료일',
    'd_1_완료일',
    'd_2_완료일',
    'e_완료일',
    'f_완료일',
    '탈락',
] as const;

// ✅ 기본 단계 + 최근 3개월 전 ~ 3개월 후의 월센등 옵션 자동 생성
const STAGE_OPTIONS = [
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'D-1',
    'D-2',
    ...Array.from({ length: 7 }, (_, i) => {
        const date = dayjs().subtract(3, 'month').add(i, 'month');
        return `${date.year()}년 ${date.month() + 1}월센등`;
    }),
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
    const [searchText, setSearchText] = useState('');
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingDates, setEditingDates] = useState<Partial<Record<string, Dayjs | null>>>({});
    const [editingStages, setEditingStages] = useState<Partial<Record<number, string>>>({});

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

    const handleEdit = (record: Student) => {
        setEditingId(record.id);
        setEditingStages((prev) => ({ ...prev, [record.id]: record.단계 ?? '' }));

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
        if (!searchText) return students;
        return students.filter((student) => student.이름.toLowerCase().includes(searchText.toLowerCase()));
    }, [students, searchText]);

    const columns: ColumnsType<Student> = [
        { title: 'id', dataIndex: 'id', key: 'id', width: 70 },
        {
            title: '단계',
            dataIndex: '단계',
            key: '단계',
            width: 160,
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
        { title: '이름', dataIndex: '이름', key: '이름', width: 100 },
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
                    <span className="flex gap-2">
                        <Button
                            size="small"
                            type="primary"
                            onClick={() => handleSave(record.id)}
                        >
                            저장
                        </Button>
                        <Button
                            size="small"
                            onClick={() => setEditingId(null)}
                        >
                            취소
                        </Button>
                    </span>
                ) : (
                    <span className="flex gap-2">
                        <Button
                            size="small"
                            onClick={() => handleEdit(record)}
                        >
                            수정
                        </Button>
                        <Popconfirm
                            title="삭제하시겠습니까?"
                            onConfirm={() => handleDelete(record.id)}
                            okText="삭제"
                            cancelText="취소"
                        >
                            <Button
                                danger
                                size="small"
                            >
                                삭제
                            </Button>
                        </Popconfirm>
                    </span>
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
            <div className="mb-4">
                <Search
                    placeholder="이름으로 검색"
                    allowClear
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: 300 }}
                    value={searchText}
                />
            </div>
            <Table
                dataSource={filteredStudents}
                columns={columns}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 50 }}
                scroll={{ x: 1500 }}
                size="middle"
            />
        </div>
    );
}
