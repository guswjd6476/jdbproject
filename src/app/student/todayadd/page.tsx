'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Table, Typography, DatePicker, Input, message, Space, Button, Popconfirm, Grid } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Breakpoint } from 'antd/es/_util/responsiveObserver';
import dayjs, { Dayjs } from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { SearchOutlined } from '@ant-design/icons';
import { useUser } from '@/app/hook/useUser';

dayjs.extend(isBetween);

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

    // 여기가 수정된 부분입니다.
    const calculateSummary = (students: StudentBrief[], range: [Dayjs, Dayjs]) => {
        const [start, end] = range;
        const regionOrder = ['도봉', '성북', '노원', '중랑', '강북', '대학', '새신자'];

        // regionOrder를 기반으로 summary 객체를 0으로 초기화합니다.
        const summary: { [key: string]: SummaryData } = regionOrder.reduce((acc, region) => {
            acc[region] = { key: region, 지역: region, 발: 0, 찾: 0, 합: 0, 섭: 0, 복: 0, 예정: 0 };
            return acc;
        }, {} as { [key: string]: SummaryData });

        students.forEach((student) => {
            const { 인도자지역, 교사지역, 발_완료일, 찾_완료일, 합_완료일, 섭_완료일, 복_완료일, 예정_완료일 } =
                student;

            // 인도자 기준 집계 (발, 찾, 합)
            if (인도자지역 && summary[인도자지역]) {
                // 초기화된 지역 목록에 있는 경우에만 집계
                if (발_완료일 && dayjs(발_완료일).isBetween(start, end, null, '[]')) summary[인도자지역].발++;
                if (찾_완료일 && dayjs(찾_완료일).isBetween(start, end, null, '[]')) summary[인도자지역].찾++;
                if (합_완료일 && dayjs(합_완료일).isBetween(start, end, null, '[]')) summary[인도자지역].합++;
            }

            // 교사 기준 집계 (섭, 복, 예정)
            if (교사지역 && summary[교사지역]) {
                // 초기화된 지역 목록에 있는 경우에만 집계
                if (섭_완료일 && dayjs(섭_완료일).isBetween(start, end, null, '[]')) summary[교사지역].섭++;
                if (복_완료일 && dayjs(복_완료일).isBetween(start, end, null, '[]')) summary[교사지역].복++;
                if (예정_완료일 && dayjs(예정_완료일).isBetween(start, end, null, '[]')) summary[교사지역].예정++;
            }
        });

        // regionOrder 순서대로 데이터를 매핑하여 최종 배열을 생성합니다.
        const orderedSummaryData = regionOrder.map((region) => summary[region]);
        setSummaryData(orderedSummaryData);
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

    useEffect(() => {
        calculateSummary(students, dateRange);
    }, [students, dateRange]);

    const filteredStudents = useMemo(() => {
        if (!searchText.trim()) return students;
        const lower = searchText.toLowerCase();
        return students.filter((s) =>
            Object.values(s).some((value) => typeof value === 'string' && value.toLowerCase().includes(lower))
        );
    }, [students, searchText]);

    const formatDate = (val: string | null) => (val ? dayjs(val).format('YY-MM-DD') : '-');

    const summaryColumns: ColumnsType<SummaryData> = [
        { title: '지역', dataIndex: '지역', key: '지역' }, // 순서가 고정되므로 sorter 제거
        { title: '발', dataIndex: '발', key: '발', sorter: (a, b) => a.발 - b.발 },
        { title: '찾', dataIndex: '찾', key: '찾', sorter: (a, b) => a.찾 - b.찾 },
        { title: '합', dataIndex: '합', key: '합', sorter: (a, b) => a.합 - b.합 },
        { title: '섭', dataIndex: '섭', key: '섭', sorter: (a, b) => a.섭 - b.섭 },
        { title: '복', dataIndex: '복', key: '복', sorter: (a, b) => a.복 - b.복 },
        { title: '예정', dataIndex: '예정', key: '예정', sorter: (a, b) => a.예정 - b.예정 },
    ];

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
                    if (name.length <= 1) return name;
                    if (name.length === 2) return name[0] + 'O';
                    if (name.length === 3) return name[0] + 'O' + name[2];
                    return name[0] + 'O'.repeat(name.length - 2) + name[name.length - 1];
                })();
                return (
                    <div onClick={() => setVisibleId(isVisible ? null : record.id)} className="cursor-pointer">
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
                    발:{formatDate(record.발_완료일)} 찾:{formatDate(record.찾_완료일)} 합:
                    {formatDate(record.합_완료일)}
                    {'\n'} 섭:{formatDate(record.섭_완료일)} 복:{formatDate(record.복_완료일)} 예정:
                    {formatDate(record.예정_완료일)} 탈:{formatDate(record.탈락)}
                </div>
            ),
        },
        ...(['발', '찾', '합', '섭', '복', '예정'] as const).map((key) => ({
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
                    <Button danger size="small">
                        삭제
                    </Button>
                </Popconfirm>
            ),
        });
    }

    return (
        <div className="mt-6 px-2 sm:px-4 w-full mx-auto">
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <div>
                    <Title level={4}>📊 오늘의 현황</Title>
                    <Table
                        columns={summaryColumns}
                        dataSource={summaryData}
                        pagination={false}
                        bordered
                        size="small"
                        locale={{ emptyText: '해당 기간에 집계된 현황이 없습니다.' }}
                        scroll={{ x: 'max-content' }}
                    />
                </div>

                <div>
                    <Title level={4}>📋 등록/수정된 명단</Title>

                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
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
            </Space>
        </div>
    );
}
