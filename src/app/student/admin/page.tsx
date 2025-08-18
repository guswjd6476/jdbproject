'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Table, Input, Button, DatePicker, Popconfirm, message, Spin, Alert } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { useUser } from '@/app/hook/useUser';
import Link from 'next/link'; // 1. Link 컴포넌트 임포트

const { Search } = Input;

const COMPLETION_FIELDS = [
    '발_완료일',
    '찾_완료일',
    '합_완료일',
    '섭_완료일',
    '복_완료일',
    '예정_완료일',
    '센확_완료일',
] as const;

type Student = {
    id: number;
    번호: number;
    이름: string;
    연락처?: string;
    생년월일?: string;
    인도자_고유번호?: string;
    교사_고유번호?: string;
    단계?: string;
    탈락?: string;
    [key: string]: string | number | undefined;
};

export default function AdminStudentManager() {
    // 2. useUser 훅에서 role과 isLoading 상태를 가져옵니다.
    const { role, isLoading: isUserLoading } = useUser();

    const [students, setStudents] = useState<Student[]>([]);
    const [searchText, setSearchText] = useState('');
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingDates, setEditingDates] = useState<Partial<Record<string, Dayjs | null>>>({});

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
    }, [role]); // role 값이 확정된 후에 fetch를 실행합니다.

    const handleEdit = (record: Student) => {
        setEditingId(record.번호);
        const newDates: Partial<Record<string, Dayjs | null>> = {};
        COMPLETION_FIELDS.forEach((field) => {
            newDates[field] = record[field] ? dayjs(record[field]) : null;
        });
        setEditingDates(newDates);
    };

    const handleDateChange = (field: string, date: Dayjs | null) => {
        setEditingDates((prev) => ({ ...prev, [field]: date }));
    };

    const handleSave = async (번호: number) => {
        try {
            const payload: Record<string, string | null> = {};
            for (const key of COMPLETION_FIELDS) {
                payload[key] = editingDates[key]?.format('YYYY-MM-DD') ?? null;
            }

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
        { title: '이름', dataIndex: '이름', key: '이름', width: 100 },
        { title: '연락처', dataIndex: '연락처', key: '연락처', width: 120 },
        ...COMPLETION_FIELDS.map((key) => ({
            title: key.replace('_완료일', '').toUpperCase(),
            dataIndex: key,
            key,
            width: 150,
            render: (value: string | null, record: Student) => {
                const isEditing = editingId === record.번호;
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
                const isEditing = editingId === record.번호;
                return isEditing ? (
                    <span className="flex gap-2">
                        <Button size="small" type="primary" onClick={() => handleSave(record.번호)}>
                            저장
                        </Button>
                        <Button size="small" onClick={() => setEditingId(null)}>
                            취소
                        </Button>
                    </span>
                ) : (
                    <span className="flex gap-2">
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
                    </span>
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
            <div className="mb-4">
                <Search
                    placeholder="이름으로 검색"
                    allowClear
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: 300 }}
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
