'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Table, Typography, DatePicker, Input, message, Space, Button, Popconfirm, Grid, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Breakpoint } from 'antd/es/_util/responsiveObserver';
import dayjs, { Dayjs } from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { SearchOutlined } from '@ant-design/icons';
import { useUser } from '@/app/hook/useUser';

dayjs.extend(isBetween);

const { Title } = Typography;
const { RangePicker } = DatePicker;

// --- 인터페이스 생략 (기존과 동일) ---
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
    발_완료일: string | null;
    찾_완료일: string | null;
    합_완료일: string | null;
    섭_완료일: string | null;
    복_완료일: string | null;
    예정_완료일: string | null;
    탈락: string | null;
}

interface SummaryData {
    key: string;
    지역: string;
    발: number;
    찾: number;
    합: number;
    섭: number;
    복: number;
    예정: number;
}

export default function TodayStudentList() {
    const [students, setStudents] = useState<StudentBrief[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
    const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('day'), dayjs().endOf('day')]);
    const [searchText, setSearchText] = useState('');
    const [visibleId, setVisibleId] = useState<number | null>(null);
    const { isAdmin } = useUser();
    const [summaryData, setSummaryData] = useState<SummaryData[]>([]);

    // --- 데이터 fetch 및 요약 로직 (기존과 동일하되 생략) ---
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

    const calculateSummary = (students: StudentBrief[], range: [Dayjs, Dayjs]) => {
        const [start, end] = range;
        const regionOrder = ['도봉', '성북', '노원', '중랑', '강북', '대학', '새신자'];
        const summary: { [key: string]: SummaryData } = regionOrder.reduce((acc, region) => {
            acc[region] = { key: region, 지역: region, 발: 0, 찾: 0, 합: 0, 섭: 0, 복: 0, 예정: 0 };
            return acc;
        }, {} as { [key: string]: SummaryData });

        students.forEach((student) => {
            const { 인도자지역, 교사지역, 발_완료일, 찾_완료일, 합_완료일, 섭_완료일, 복_완료일, 예정_완료일 } =
                student;
            if (인도자지역 && summary[인도자지역]) {
                if (발_완료일 && dayjs(발_완료일).isBetween(start, end, null, '[]')) summary[인도자지역].발++;
                if (찾_완료일 && dayjs(찾_완료일).isBetween(start, end, null, '[]')) summary[인도자지역].찾++;
                if (합_완료일 && dayjs(합_완료일).isBetween(start, end, null, '[]')) summary[인도자지역].합++;
            }
            if (교사지역 && summary[교사지역]) {
                if (섭_완료일 && dayjs(섭_완료일).isBetween(start, end, null, '[]')) summary[교사지역].섭++;
                if (복_완료일 && dayjs(복_완료일).isBetween(start, end, null, '[]')) summary[교사지역].복++;
                if (예정_완료일 && dayjs(예정_완료일).isBetween(start, end, null, '[]')) summary[교사지역].예정++;
            }
        });
        setSummaryData(regionOrder.map((region) => summary[region]));
    };

    useEffect(() => {
        refreshList();
    }, [dateRange]);
    useEffect(() => {
        calculateSummary(students, dateRange);
    }, [students, dateRange]);

    const refreshList = () => {
        const [start, end] = dateRange;
        fetchStudents(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'));
    };

    const filteredStudents = useMemo(() => {
        if (!searchText.trim()) return students;
        const lower = searchText.toLowerCase();
        return students.filter((s) =>
            Object.values(s).some((value) => typeof value === 'string' && value.toLowerCase().includes(lower))
        );
    }, [students, searchText]);

    // --- 헬퍼 함수: 필터 옵션 생성 ---
    const getFilters = (data: any[], key: string) => {
        const unique = Array.from(new Set(data.map((item) => item[key]).filter(Boolean)));
        return unique.map((val) => ({ text: String(val), value: String(val) }));
    };

    const formatDate = (val: string | null) => (val ? dayjs(val).format('YY-MM-DD') : '-');

    // 1. 현황 테이블 컬럼 (SummaryTable)
    const summaryColumns: ColumnsType<SummaryData> = [
        { title: '지역', dataIndex: '지역', key: '지역' },
        { title: '발', dataIndex: '발', key: '발', sorter: (a, b) => a.발 - b.발 },
        { title: '찾', dataIndex: '찾', key: '찾', sorter: (a, b) => a.찾 - b.찾 },
        { title: '합', dataIndex: '합', key: '합', sorter: (a, b) => a.합 - b.합 },
        { title: '섭', dataIndex: '섭', key: '섭', sorter: (a, b) => a.섭 - b.섭 },
        { title: '복', dataIndex: '복', key: '복', sorter: (a, b) => a.복 - b.복 },
        { title: '예정', dataIndex: '예정', key: '예정', sorter: (a, b) => a.예정 - b.예정 },
    ];

    // 2. 명단 테이블 컬럼 (MainTable)
    const columns: ColumnsType<StudentBrief> = [
        {
            title: '번호',
            dataIndex: 'id',
            key: 'id',
            responsive: ['md'],
            sorter: (a, b) => a.id - b.id,
        },
        {
            title: '이름',
            dataIndex: '이름',
            key: '이름',
            width: 90,
            sorter: (a, b) => a.이름.localeCompare(b.이름, 'ko'),
            render: (name: string, record) => {
                const isVisible = visibleId === record.id;
                const maskedName =
                    name.length <= 1
                        ? name
                        : name[0] + 'O'.repeat(name.length - 2) + (name.length > 2 ? name[name.length - 1] : 'O');
                return (
                    <div
                        onClick={() => setVisibleId(isVisible ? null : record.id)}
                        className="cursor-pointer hover:text-blue-500 transition-colors"
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
            filters: getFilters(students, '단계'),
            onFilter: (value, record) => record.단계 === value,
            sorter: (a, b) => a.단계.localeCompare(b.단계, 'ko'),
        },
        {
            title: '인도자',
            key: '인도자',
            filters: getFilters(students, '인도자지역'),
            filterSearch: true,
            onFilter: (value, record) => record.인도자지역 === value,
            sorter: (a, b) => String(a.인도자지역).localeCompare(String(b.인도자지역), 'ko'),
            render: (_, record) =>
                record.인도자지역 && record.인도자이름
                    ? `${record.인도자지역}/${record.인도자구역}/${record.인도자이름}`
                    : '-',
        },
        {
            title: '교사',
            key: '교사',
            filters: getFilters(students, '교사지역'),
            filterSearch: true,
            onFilter: (value, record) => record.교사지역 === value,
            sorter: (a, b) => String(a.교사지역).localeCompare(String(b.교사지역), 'ko'),
            render: (_, record) =>
                record.교사지역 && record.교사이름 ? `${record.교사지역}/${record.교사구역}/${record.교사이름}` : '-',
        },
        ...['발', '찾', '합', '섭', '복', '예정'].map((key) => ({
            title: `${key.toUpperCase()} 완료일`,
            dataIndex: `${key}_완료일`,
            key: `${key}_완료일`,
            sorter: (a: any, b: any) => dayjs(a[`${key}_완료일`] || 0).unix() - dayjs(b[`${key}_완료일`] || 0).unix(),
            render: (val: string | null) => formatDate(val),
            responsive: ['sm'] as Breakpoint[],
        })),
        {
            title: '탈락일',
            dataIndex: '탈락',
            key: '탈락',
            sorter: (a, b) => dayjs(a.탈락 || 0).unix() - dayjs(b.탈락 || 0).unix(),
            render: (val) => formatDate(val),
            responsive: ['sm'] as Breakpoint[],
        },
    ];

    if (isAdmin) {
        columns.push({
            title: '관리',
            key: 'action',
            render: (_, record) => (
                <Popconfirm
                    title="삭제하시겠습니까?"
                    onConfirm={() => handleDelete(record.id)}
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

    const handleDelete = async (id: number) => {
        /* 삭제 로직 기존과 동일 */
    };
    const handleBulkDelete = async () => {
        /* 삭제 로직 기존과 동일 */
    };

    return (
        <div className="mt-6 px-2 sm:px-4 w-full mx-auto pb-10">
            <Space
                direction="vertical"
                size="large"
                style={{ width: '100%' }}
            >
                <section>
                    <Title level={4}>📊 오늘의 현황</Title>
                    <Table
                        columns={summaryColumns}
                        dataSource={summaryData}
                        pagination={false}
                        bordered
                        size="small"
                        scroll={{ x: 'max-content' }}
                    />
                </section>

                <section>
                    <Title level={4}>📋 등록/수정된 명단</Title>
                    <Space
                        direction="vertical"
                        size="middle"
                        style={{ width: '100%' }}
                    >
                        <div className="flex flex-wrap gap-2 justify-between">
                            <Space wrap>
                                <RangePicker
                                    value={dateRange}
                                    onChange={(range) =>
                                        range &&
                                        range[0] &&
                                        range[1] &&
                                        setDateRange([range[0].startOf('day'), range[1].endOf('day')])
                                    }
                                    allowClear={false}
                                    presets={[
                                        { label: '오늘', value: [dayjs().startOf('day'), dayjs().endOf('day')] },
                                        { label: '이번 주', value: [dayjs().startOf('week'), dayjs().endOf('week')] },
                                        { label: '이번 달', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
                                    ]}
                                />
                                <Input
                                    placeholder="전체 검색..."
                                    prefix={<SearchOutlined />}
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    style={{ width: 250 }}
                                    allowClear
                                />
                            </Space>
                            {isAdmin && selectedRowKeys.length > 0 && (
                                <Popconfirm
                                    title="일괄 삭제하시겠습니까?"
                                    onConfirm={handleBulkDelete}
                                >
                                    <Button
                                        danger
                                        type="primary"
                                    >
                                        선택 삭제 ({selectedRowKeys.length}명)
                                    </Button>
                                </Popconfirm>
                            )}
                        </div>

                        <Table
                            dataSource={filteredStudents}
                            columns={columns}
                            rowKey="id"
                            rowSelection={
                                isAdmin
                                    ? { selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys as number[]) }
                                    : undefined
                            }
                            loading={loading}
                            bordered
                            size="middle"
                            scroll={{ x: 'max-content' }}
                            pagination={{ pageSize: 100, showSizeChanger: true }}
                        />
                    </Space>
                </section>
            </Space>
        </div>
    );
}
