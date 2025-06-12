'use client';
import React, { useState, useMemo } from 'react';
import { Card, CardContent } from './ui/Card';
import { Input, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { FilterValue } from 'antd/es/table/interface';
import { useStudentsQuery, Student } from '../hook/useStudentsQuery';

const { Search } = Input;

const COMPLETION_KEYS = ['a', 'b', 'c', 'd-1', 'd-2', 'e', 'f'] as const;

export default function StudentViewer() {
    const { data: students = [], isLoading } = useStudentsQuery();
    const [searchText, setSearchText] = useState('');
    const [filters, setFilters] = useState<Record<string, FilterValue | null>>({});

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

    const filterableColumn = (title: string, dataIndex: keyof Student): ColumnsType<Student>[number] => ({
        title,
        dataIndex,
        key: dataIndex,
        width: 120,
        filters: getFilterOptions(dataIndex),
        filteredValue: filters[dataIndex as string] || null,
        onFilter: (value, record) => record[dataIndex] === value,
    });

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
                            loading={isLoading}
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
