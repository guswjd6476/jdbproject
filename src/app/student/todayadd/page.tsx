'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Table, Typography, DatePicker, Input, message, Space, Button, Popconfirm } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { SearchOutlined } from '@ant-design/icons';
import { useUser } from '@/app/hook/useUser';

const { Title } = Typography;
const { RangePicker } = DatePicker;

interface StudentBrief {
    id: number;
    이름: string;
    단계: string;
    인도자지역: string | null;
    인도자구역: string | null;
    인도자이름: string | null;
    교사지역: string | null;
    교사구역: string | null;
    교사이름: string | null;
}

export default function TodayStudentList() {
    const [students, setStudents] = useState<StudentBrief[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
    const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('day'), dayjs().endOf('day')]);
    const [searchText, setSearchText] = useState('');
    const [visibleId, setVisibleId] = useState<number | null>(null);
    const { isAdmin } = useUser();

    const fetchStudents = async (start: string, end: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/students/today?start=${start}&end=${end}`);
            if (!res.ok) throw new Error('명단 조회 실패');
            const data = await res.json();
            setStudents(data);
        } catch (e) {
            message.error((e as Error).message || '에러 발생');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            const res = await fetch('/api/students/delete', {
                method: 'DELETE',
                body: JSON.stringify({ ids: [id] }),
            });
            if (!res.ok) throw new Error('삭제 실패');
            message.success('삭제 완료');
            refreshList();
        } catch {
            message.error('삭제 중 오류 발생');
        }
    };

    const handleBulkDelete = async () => {
        try {
            const res = await fetch('/api/students/delete', {
                method: 'DELETE',
                body: JSON.stringify({ ids: selectedRowKeys }),
            });
            if (!res.ok) throw new Error('일괄 삭제 실패');
            message.success('일괄 삭제 완료');
            setSelectedRowKeys([]);
            refreshList();
        } catch {
            message.error('삭제 중 오류 발생');
        }
    };

    const refreshList = () => {
        const [start, end] = dateRange;
        fetchStudents(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'));
    };

    useEffect(() => {
        refreshList();
    }, [dateRange]);

    const filteredStudents = useMemo(() => {
        if (!searchText.trim()) return students;
        const lower = searchText.toLowerCase();
        return students.filter((s) =>
            Object.values(s).some((value) => typeof value === 'string' && value.toLowerCase().includes(lower))
        );
    }, [students, searchText]);

    const columns: ColumnsType<StudentBrief> = [
        {
            title: '번호',
            dataIndex: 'id',
            key: 'id',
        },
        {
            title: '이름',
            dataIndex: '이름',
            key: '이름',
            width: 80,
            sorter: (a, b) => a.이름.localeCompare(b.이름),
            render: (name: string, record) => {
                const isVisible = visibleId === record.id;
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
                            setVisibleId(isVisible ? null : record.id);
                        }}
                        className="cursor-pointer flex items-center gap-1"
                    >
                        <span>{isVisible ? name : maskedName}</span>
                    </div>
                );
            },
        },
        {
            title: '단계',
            dataIndex: '단계',
            key: '단계',
            sorter: (a, b) => a.단계.localeCompare(b.단계),
        },
        {
            title: '인도자',
            key: '인도자',
            render: (_, record) =>
                record.인도자지역 && record.인도자구역 && record.인도자이름
                    ? `${record.인도자지역} / ${record.인도자구역} / ${record.인도자이름}`
                    : '-',
            sorter: (a, b) =>
                `${a.인도자지역 ?? ''}${a.인도자구역 ?? ''}${a.인도자이름 ?? ''}`.localeCompare(
                    `${b.인도자지역 ?? ''}${b.인도자구역 ?? ''}${b.인도자이름 ?? ''}`
                ),
        },
        {
            title: '교사',
            key: '교사',
            render: (_, record) =>
                record.교사지역 && record.교사구역 && record.교사이름
                    ? `${record.교사지역} / ${record.교사구역} / ${record.교사이름}`
                    : '-',
            sorter: (a, b) =>
                `${a.교사지역 ?? ''}${a.교사구역 ?? ''}${a.교사이름 ?? ''}`.localeCompare(
                    `${b.교사지역 ?? ''}${b.교사구역 ?? ''}${b.교사이름 ?? ''}`
                ),
        },
    ];

    if (isAdmin) {
        columns.push({
            title: '삭제',
            key: '삭제',
            render: (_, record) => (
                <Popconfirm
                    title="정말 삭제하시겠습니까?"
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
            ),
        });
    }

    return (
        <div className="mt-6 px-4 max-w-screen-lg mx-auto">
            <Title level={4}>📋 등록/수정된 명단</Title>

            <Space
                direction="vertical"
                size="middle"
                style={{ width: '100%' }}
            >
                <RangePicker
                    value={dateRange}
                    onChange={(range) => {
                        if (range && range[0] && range[1]) {
                            setDateRange([range[0].startOf('day'), range[1].endOf('day')]);
                        }
                    }}
                    allowClear={false}
                    presets={[
                        { label: '오늘', value: [dayjs().startOf('day'), dayjs().endOf('day')] },
                        { label: '이번 주', value: [dayjs().startOf('week'), dayjs().endOf('week')] },
                        { label: '이번 달', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
                    ]}
                />

                <Input
                    placeholder="이름, 단계, 인도자, 교사 등 검색"
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    allowClear
                />

                {isAdmin && selectedRowKeys.length > 0 && (
                    <Popconfirm
                        title="선택한 명단을 삭제하시겠습니까?"
                        onConfirm={handleBulkDelete}
                        okText="삭제"
                        cancelText="취소"
                    >
                        <Button danger>선택 삭제 ({selectedRowKeys.length}명)</Button>
                    </Popconfirm>
                )}

                <Table
                    dataSource={filteredStudents}
                    columns={columns}
                    rowKey="id"
                    rowSelection={
                        isAdmin
                            ? {
                                  selectedRowKeys,
                                  onChange: (keys) => setSelectedRowKeys(keys as number[]),
                              }
                            : undefined
                    }
                    loading={loading}
                    bordered
                    locale={{ emptyText: '해당 기간에 등록/수정된 명단이 없습니다.' }}
                    pagination={{ pageSize: 50 }}
                    size="middle"
                />
            </Space>
        </div>
    );
}
