'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Table, Typography, DatePicker, Input, message, Space, Button, Popconfirm, Grid } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Breakpoint } from 'antd/es/_util/responsiveObserver';
import dayjs, { Dayjs } from 'dayjs';
import { SearchOutlined } from '@ant-design/icons';
import { useUser } from '@/app/hook/useUser';

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

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
    a_완료일: string | null;
    b_완료일: string | null;
    c_완료일: string | null;
    d_1_완료일: string | null;
    d_2_완료일: string | null;
    e_완료일: string | null;
    f_완료일: string | null;
    탈락: string | null;
}

export default function TodayStudentList() {
    const [students, setStudents] = useState<StudentBrief[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
    const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('day'), dayjs().endOf('day')]);
    const [searchText, setSearchText] = useState('');
    const [visibleId, setVisibleId] = useState<number | null>(null);
    const { isAdmin } = useUser();
    const screens = useBreakpoint();

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

    const formatDate = (val: string | null) => (val ? dayjs(val).format('YY-MM-DD') : '-');

    const columns: ColumnsType<StudentBrief> = [
        {
            title: '번호',
            dataIndex: 'id',
            key: 'id',
            responsive: ['md'] as Breakpoint[],
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
                        onClick={() => setVisibleId(isVisible ? null : record.id)}
                        className="cursor-pointer"
                    >
                        {isVisible ? name : maskedName}
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
                record.인도자지역 && record.인도자이름
                    ? `${record.인도자지역}/${record.인도자구역}/${record.인도자이름}`
                    : '-',
        },
        {
            title: '교사',
            key: '교사',
            render: (_, record) =>
                record.교사지역 && record.교사이름 ? `${record.교사지역}/${record.교사구역}/${record.교사이름}` : '-',
        },
        {
            title: '완료일',
            key: '완료일',
            responsive: ['xs'] as Breakpoint[],
            render: (_, record) => (
                <div className="text-xs whitespace-pre-line">
                    A:{formatDate(record.a_완료일)} B:{formatDate(record.b_완료일)} C:{formatDate(record.c_완료일)}
                    {'\n'}D1:{formatDate(record.d_1_완료일)} D2:{formatDate(record.d_2_완료일)} E:
                    {formatDate(record.e_완료일)} F:{formatDate(record.f_완료일)} 탈:{formatDate(record.탈락)}
                </div>
            ),
        },
        ...(['a', 'b', 'c', 'd_1', 'd_2', 'e', 'f'] as const).map((key) => ({
            title: `${key.toUpperCase().replace('_', '-')} 완료일`,
            dataIndex: `${key}_완료일`,
            key: `${key}_완료일`,
            render: (val: string | null) => formatDate(val),
            responsive: ['sm'] as Breakpoint[],
        })),
        {
            title: '탈락일',
            dataIndex: '탈락',
            key: '탈락',
            render: (val) => formatDate(val),
            responsive: ['sm'] as Breakpoint[],
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
        <div className="mt-6 px-2 sm:px-4 w-full mx-auto">
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
                    size="middle"
                    scroll={{ x: 'max-content' }}
                />
            </Space>
        </div>
    );
}
