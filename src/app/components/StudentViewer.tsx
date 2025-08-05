'use client';
import React, { useState, useMemo } from 'react';
import { Card, CardContent } from './ui/Card';
import { Input, Table, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { FilterValue } from 'antd/es/table/interface';
import { useStudentsQuery, Students } from '../hook/useStudentsQuery';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { useUser } from '../hook/useUser';

const { Search } = Input;
const COMPLETION_KEYS = ['발', '찾', '합', '섭', '복', '예정', 'g', '센확'] as const;

export default function StudentViewer() {
    const { data: students = [], isLoading } = useStudentsQuery();
    const { isAdmin } = useUser();
    const [searchText, setSearchText] = useState('');
    const [filters, setFilters] = useState<Record<string, FilterValue | null>>({});
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
    const [visibleId, setVisibleId] = useState<number | null>(null);

    const allRegions = useMemo(() => {
        const regions = new Set<string>();
        students.forEach((s) => {
            if (s.인도자지역) regions.add(String(s.인도자지역));
            if (s.교사지역) regions.add(String(s.교사지역));
        });
        return Array.from(regions).sort();
    }, [students]);

    const filteredStudents = useMemo(() => {
        return students
            .filter((student) => {
                if (!searchText.trim()) return true;
                const query = searchText.toLowerCase();
                return [student.이름, student.연락처, student.인도자이름, student.교사이름].some(
                    (field) => typeof field === 'string' && field.toLowerCase().includes(query)
                );
            })
            .filter((student) =>
                Object.entries(filters).every(([key, values]) => {
                    if (!values || values.length === 0) return true;
                    const fieldKey = key as keyof Students;
                    const val = student[fieldKey];
                    return val != null && values.includes(String(val));
                })
            )
            .filter((student) => {
                if (!selectedRegion) return true;
                return String(student.인도자지역) === selectedRegion || String(student.교사지역) === selectedRegion;
            });
    }, [students, searchText, filters, selectedRegion]);

    const getFilterOptions = (field: keyof Students) => {
        const values = students
            .map((s) => s[field])
            .filter((val): val is string | number => val !== undefined && val !== null)
            .map((val) => String(val));

        return Array.from(new Set(values))
            .sort()
            .map((value) => ({ text: value, value }));
    };

    const filterableColumn = (title: string, dataIndex: keyof Students): ColumnsType<Students>[number] => ({
        title,
        dataIndex,
        key: dataIndex,
        width: 120,
        filters: getFilterOptions(dataIndex),
        filteredValue: filters[dataIndex as string] || null,
        onFilter: (value, record) => String(record[dataIndex]) === String(value),
    });

    const completionColumns = COMPLETION_KEYS.map((key): ColumnsType<Students>[number] => ({
        title: key === 'g' ? '탈락 완료일' : `${key.toUpperCase()} 완료일`,
        dataIndex: key,
        key,
        width: 110,
        sorter: (a, b) => new Date(a[key] ?? '').getTime() - new Date(b[key] ?? '').getTime(),
        render: (value) => (value ? dayjs(value).format('YYYY.MM.DD') : ''),
    }));

    const columns: ColumnsType<Students> = [
        { title: '번호', dataIndex: '번호', key: '번호', fixed: 'left', width: 70 },
        filterableColumn('단계', '단계'),
        {
            title: '이름',
            dataIndex: '이름',
            key: '이름',
            fixed: 'left',
            width: 80,
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
        { title: '연락처', dataIndex: '연락처', key: '연락처', width: 120 },
        {
            title: '생년월일',
            dataIndex: '생년월일',
            key: '생년월일',
            width: 110,
            render: (value: string) => {
                if (!value) return '';
                const padded = value.padStart(6, '0');
                return padded.slice(0, 2);
            },
        },
        filterableColumn('인도자지역', '인도자지역'),
        filterableColumn('인도자팀', '인도자팀'),
        { title: '인도자이름', dataIndex: '인도자이름', key: '인도자이름', width: 100 },
        filterableColumn('교사지역', '교사지역'),
        filterableColumn('교사팀', '교사팀'),
        { title: '교사이름', dataIndex: '교사이름', key: '교사이름', width: 100 },
        ...completionColumns,
    ];

    const handleExportForUser = () => {
        const exportData = filteredStudents.map((student) => {
            const row: Record<string, any> = {
                번호: student.번호,
                단계: student.단계,
                이름: student.이름,
                연락처: student.연락처,
                생년월일: student.생년월일,

                인도자지역: student.인도자지역 ?? '',
                인도자구역: student.인도자팀 ? `${String(student.인도자팀).trim()}` : '',
                인도자이름: student.인도자이름 ?? '',

                교사지역: student.교사지역 ?? '',
                교사구역: student.교사팀 ? `${String(student.교사팀).trim()}` : '',
                교사이름: student.교사이름 ?? '',
            };

            COMPLETION_KEYS.forEach((key) => {
                const label = key === 'g' ? '탈락 완료일' : `${key.toUpperCase()} 완료일`;
                row[label] = student[key] ? dayjs(student[key]).format('YYYY-MM-DD') : '';
            });

            return row;
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '수강생 목록');
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        saveAs(blob, `수강생_일반_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`);
    };

    const handleExportForAdmin = () => {
        const exportData = filteredStudents.map((student) => {
            const row: Record<string, any> = {
                번호: student.번호,
                단계: student.단계,
                이름: student.이름,
                연락처: student.연락처,
                생년월일: student.생년월일,

                인도자고유번호: student.인도자_고유번호 ?? '',
                교사고유번호: student.교사_고유번호 ?? '',
            };

            COMPLETION_KEYS.forEach((key) => {
                const label = key === 'g' ? '탈락 완료일' : `${key.toUpperCase()} 완료일`;
                row[label] = student[key] ? dayjs(student[key]).format('YYYY-MM-DD') : '';
            });

            return row;
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '관리자용');
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        saveAs(blob, `수강생_관리자_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`);
    };

    return (
        <div className="p-4 md:p-6 max-w-full">
            <h1 className="text-xl md:text-2xl font-bold mb-4">수강생 조회</h1>
            <Card>
                <CardContent>
                    {/* 지역 필터 버튼 */}
                    <div className="mb-4 flex flex-wrap gap-2">
                        <Button type={!selectedRegion ? 'primary' : 'default'} onClick={() => setSelectedRegion(null)}>
                            전체
                        </Button>
                        {allRegions.map((region) => (
                            <Button
                                key={region}
                                type={selectedRegion === region ? 'primary' : 'default'}
                                onClick={() => setSelectedRegion(region)}
                            >
                                {region}
                            </Button>
                        ))}
                    </div>

                    <div className="mb-4 flex gap-2 flex-wrap">
                        <Button onClick={handleExportForUser} type="default">
                            엑셀로 내보내기 (일반)
                        </Button>
                        {isAdmin && (
                            <Button onClick={handleExportForAdmin} type="dashed">
                                엑셀로 내보내기 (관리자용)
                            </Button>
                        )}
                    </div>

                    {/* 검색창 */}
                    <Search
                        placeholder="이름, 연락처, 인도자이름, 교사이름 검색"
                        allowClear
                        enterButton="검색"
                        size="middle"
                        onSearch={(value) => setSearchText(value.trim())}
                        onChange={(e) => e.target.value === '' && setSearchText('')}
                        style={{ marginBottom: 16, maxWidth: 400 }}
                    />

                    {/* 테이블 */}
                    <div className="overflow-x-auto">
                        <Table<Students>
                            columns={columns}
                            dataSource={filteredStudents}
                            rowKey="id"
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
