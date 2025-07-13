'use client';

import React, { useMemo, useState } from 'react';
import { Table, Spin, Input, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Students, useStudentsBQuery } from '@/app/hook/useStudentsBQuery';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const { Search } = Input;

export default function TargetFilterPage() {
    const { data: students = [], isLoading } = useStudentsBQuery();
    const [visibleId, setVisibleId] = useState<number | null>(null);
    const [searchText, setSearchText] = useState('');

    const getUniqueValues = (key: keyof Students) => {
        return Array.from(new Set(students.map((s) => s[key]).filter(Boolean))).map((v) => ({
            text: String(v),
            value: String(v),
        }));
    };

    const filteredStudents = useMemo(() => {
        return students.filter((s) => {
            const matchSearch = !searchText || s.이름?.includes(searchText);
            return matchSearch;
        });
    }, [students, searchText]);

    const exportToExcel = () => {
        const exportData = filteredStudents.map((s) => ({
            번호: s.번호,
            단계: s.단계,
            이름: s.이름,
            인도자지역: s.인도자지역,
            인도자팀: s.인도자팀,
            인도자이름: s.인도자이름,
            교사지역: s.교사지역,
            교사팀: s.교사팀,
            교사이름: s.교사이름,
            Target: s.target,
            TryDate: s.trydate,
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

        // UTF-8 with BOM 설정
        const excelBuffer = XLSX.write(workbook, {
            bookType: 'xlsx',
            type: 'array',
        });
        const dataBlob = new Blob([excelBuffer], {
            type: 'application/octet-stream',
        });

        saveAs(dataBlob, 'students_export.xlsx');
    };

    const columns: ColumnsType<Students> = [
        {
            title: '번호',
            dataIndex: '번호',
            key: '번호',
            width: 80,
            sorter: (a, b) => a.번호 - b.번호,
        },
        {
            title: '단계',
            dataIndex: '단계',
            key: '단계',
            width: 80,
            filters: getUniqueValues('단계'),
            onFilter: (value, record) => record.단계 === value,
            sorter: (a, b) => (a.단계 || '').localeCompare(b.단계 || ''),
        },
        {
            title: '이름',
            dataIndex: '이름',
            key: '이름',
            width: 100,
            sorter: (a, b) => (a.이름 || '').localeCompare(b.이름 || ''),
            render: (name: string, record) => {
                const isVisible = visibleId === record.번호;
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
                            if (typeof record.번호 === 'number') {
                                setVisibleId(isVisible ? null : record.번호);
                            }
                        }}
                        className="cursor-pointer flex items-center gap-1"
                    >
                        <span>{isVisible ? name : maskedName}</span>
                    </div>
                );
            },
        },
        {
            title: '인도자지역',
            dataIndex: '인도자지역',
            key: '인도자지역',
            width: 100,
            filters: getUniqueValues('인도자지역'),
            onFilter: (value, record) => record.인도자지역 === value,
            sorter: (a, b) => (a.인도자지역 || '').localeCompare(b.인도자지역 || ''),
        },
        {
            title: '인도자팀',
            dataIndex: '인도자팀',
            key: '인도자팀',
            width: 100,
            filters: getUniqueValues('인도자팀'),
            onFilter: (value, record) => record.인도자팀 === value,
            sorter: (a, b) => (a.인도자팀 || '').localeCompare(b.인도자팀 || ''),
        },
        {
            title: '인도자이름',
            dataIndex: '인도자이름',
            key: '인도자이름',
            width: 100,
            filters: getUniqueValues('인도자이름'),
            onFilter: (value, record) => record.인도자이름 === value,
            sorter: (a, b) => (a.인도자이름 || '').localeCompare(b.인도자이름 || ''),
        },
        {
            title: '교사지역',
            dataIndex: '교사지역',
            key: '교사지역',
            width: 100,
            filters: getUniqueValues('교사지역'),
            onFilter: (value, record) => record.교사지역 === value,
            sorter: (a, b) => (a.교사지역 || '').localeCompare(b.교사지역 || ''),
        },
        {
            title: '교사팀',
            dataIndex: '교사팀',
            key: '교사팀',
            width: 100,
            filters: getUniqueValues('교사팀'),
            onFilter: (value, record) => record.교사팀 === value,
            sorter: (a, b) => (a.교사팀 || '').localeCompare(b.교사팀 || ''),
        },
        {
            title: '교사이름',
            dataIndex: '교사이름',
            key: '교사이름',
            width: 100,
            filters: getUniqueValues('교사이름'),
            onFilter: (value, record) => record.교사이름 === value,
            sorter: (a, b) => (a.교사이름 || '').localeCompare(b.교사이름 || ''),
        },
        {
            title: 'Target',
            dataIndex: 'target',
            key: 'target',
            width: 100,
            filters: getUniqueValues('target'),
            onFilter: (value, record) => record.target === value,
            sorter: (a, b) => (a.target || '').localeCompare(b.target || ''),
        },
        {
            title: 'Try Date',
            dataIndex: 'trydate',
            key: 'trydate',
            width: 120,
            sorter: (a, b) => new Date(a.trydate || '').getTime() - new Date(b.trydate || '').getTime(),
            render: (value: string) => (value ? value.slice(0, 10) : ''),
        },
    ];

    return (
        <Spin
            spinning={isLoading}
            tip="데이터 불러오는 중..."
        >
            <div className="p-6">
                <h2 className="text-xl font-bold mb-4">개강별 기준 학생 필터링</h2>

                <div className="mb-4 flex gap-2 flex-wrap">
                    <Search
                        placeholder="이름 검색"
                        allowClear
                        onSearch={(value) => setSearchText(value.trim())}
                        onChange={(e) => setSearchText(e.target.value.trim())}
                        style={{ width: 200 }}
                    />
                    <Button
                        onClick={exportToExcel}
                        type="primary"
                    >
                        엑셀로 내보내기
                    </Button>
                </div>

                <Table
                    dataSource={filteredStudents}
                    columns={columns}
                    rowKey="번호"
                    pagination={{ pageSize: 50 }}
                    scroll={{ x: 'max-content' }}
                    size="middle"
                />
            </div>
        </Spin>
    );
}
