'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from './ui/Card';
import { Input, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { FilterValue } from 'antd/es/table/interface';

const { Search } = Input;

interface Student {
    번호: number;
    이름: string;
    연락처: string;
    생년월일?: string;
    단계?: string;
    인도자지역?: string;
    인도자팀?: string;
    인도자이름?: string;
    교사지역?: string;
    교사팀?: string;
    교사이름?: string;
    a?: string;
    b?: string;
    c?: string;
    'd-1'?: string;
    'd-2'?: string;
    e?: string;
    f?: string;
    dropOut?: boolean;
}

const COMPLETION_KEYS = ['a', 'b', 'c', 'd-1', 'd-2', 'e', 'f'] as const;

export default function StudentViewer() {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [filters, setFilters] = useState<Record<string, FilterValue | null>>({});

    // 유니크 필터 옵션 계산
    const getFilterOptions = (field: keyof Student) =>
        Array.from(
            new Set(
                students
                    .map((s) => s[field])
                    .filter((val): val is string | number => Boolean(val))
                    .map(String)
            )
        )
            .sort()
            .map((value) => ({ text: value, value }));

    // 필터링된 수강생
    const filteredStudents = useMemo(() => {
        return students
            .filter((student) => {
                if (!searchText.trim()) return true;
                const query = searchText.toLowerCase();
                return [student.이름, student.연락처, student.인도자이름, student.교사이름].some((field) =>
                    field?.toLowerCase().includes(query)
                );
            })
            .filter((student) =>
                Object.entries(filters).every(([key, values]) => {
                    if (!values || values.length === 0) return true;
                    const fieldKey = key as keyof Student;
                    const val = student[fieldKey];
                    return val != null && values.includes(String(val));
                })
            );
    }, [students, searchText, filters]);

    useEffect(() => {
        const fetchStudents = async () => {
            try {
                const res = await fetch('/api/students');
                if (!res.ok) throw new Error('데이터를 불러오는 데 실패했습니다.');
                const data: Student[] = await res.json();
                setStudents(data.filter((s) => s.번호 != null));
            } catch (err) {
                if (err instanceof Error) {
                    console.error(err.message);
                } else {
                    console.error('알 수 없는 오류 발생');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchStudents();
    }, []);

    // 공통 필터 컬럼 생성기
    const filterableColumn = (title: string, dataIndex: keyof Student): ColumnsType<Student>[number] => ({
        title,
        dataIndex,
        key: dataIndex,
        width: 120,
        filters: getFilterOptions(dataIndex),
        filteredValue: filters[dataIndex as string] || null,
        onFilter: (value, record) => record[dataIndex] === value,
    });

    // 완료일 컬럼 생성기
    const completionColumns = COMPLETION_KEYS.map((key): ColumnsType<Student>[number] => ({
        title: `${key.toUpperCase()} 완료일`,
        dataIndex: key,
        key,
        width: 110,
        sorter: (a, b) => new Date(a[key] ?? '').getTime() - new Date(b[key] ?? '').getTime(),
    }));

    const columns: ColumnsType<Student> = [
        { title: '번호', dataIndex: '번호', key: '번호', fixed: 'left', width: 70 },
        filterableColumn('단계', '단계'),
        { title: '이름', dataIndex: '이름', key: '이름', width: 100 },
        { title: '연락처', dataIndex: '연락처', key: '연락처', width: 120 },
        { title: '생년월일', dataIndex: '생년월일', key: '생년월일', width: 110 },
        filterableColumn('인도자지역', '인도자지역'),
        filterableColumn('인도자팀', '인도자팀'),
        { title: '인도자이름', dataIndex: '인도자이름', key: '인도자이름', width: 100 },
        filterableColumn('교사지역', '교사지역'),
        filterableColumn('교사팀', '교사팀'),
        { title: '교사이름', dataIndex: '교사이름', key: '교사이름', width: 100 },
        ...completionColumns,
        {
            title: '탈락',
            dataIndex: 'dropOut',
            key: 'dropOut',
            width: 90,
            filters: [
                { text: 'true', value: true },
                { text: 'false', value: false },
            ],
            filteredValue: filters['dropOut'] || null,
            onFilter: (value, record) => record.dropOut === value,
        },
    ];

    return (
        <div className="p-4 md:p-6 max-w-full">
            <h1 className="text-xl md:text-2xl font-bold mb-4">수강생 조회</h1>
            <Card>
                <CardContent>
                    <Search
                        placeholder="이름, 연락처, 인도자이름, 교사이름 검색"
                        allowClear
                        enterButton="검색"
                        size="middle"
                        onSearch={(value) => setSearchText(value.trim())}
                        onChange={(e) => e.target.value === '' && setSearchText('')}
                        style={{ marginBottom: 16, maxWidth: 400 }}
                    />
                    <div className="overflow-x-auto">
                        <Table<Student>
                            columns={columns}
                            dataSource={filteredStudents}
                            rowKey="번호"
                            pagination={{
                                pageSize: 50,
                                showSizeChanger: true,
                                pageSizeOptions: ['20', '50', '100', '200'],
                                showTotal: (total, range) => `${range[0]}-${range[1]} / 전체 ${total}명`,
                            }}
                            loading={loading}
                            scroll={{ x: 1800 }}
                            size="middle"
                            onChange={(_, filters) => setFilters(filters)}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
