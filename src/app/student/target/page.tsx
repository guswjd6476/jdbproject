'use client';

import React, { useState, useMemo } from 'react';
import { Select, Table, Spin } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Students, useStudentsBQuery } from '@/app/hook/useStudentsBQuery';

const { Option } = Select;

export default function TargetFilterPage() {
    const { data: students = [], isLoading } = useStudentsBQuery();
    const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

    const targetOptions = useMemo(() => {
        const setTargets = new Set<string>();
        students.forEach((s) => {
            if (s.target) setTargets.add(s.target);
        });
        return Array.from(setTargets).sort();
    }, [students]);

    const filteredStudents = useMemo(() => {
        if (!selectedTarget) return students;
        return students.filter((s) => s.target === selectedTarget);
    }, [students, selectedTarget]);

    const columns: ColumnsType<Students> = [
        { title: '번호', dataIndex: '번호', key: '번호', width: 80 },

        { title: '단계', dataIndex: '단계', key: '단계', width: 80 },
        { title: '이름', dataIndex: '이름', key: '이름', width: 120 },
        { title: '인도자지역', dataIndex: '인도자지역', key: '인도자지역', width: 100 },
        { title: '인도자팀', dataIndex: '인도자팀', key: '인도자팀', width: 100 },
        { title: '교사지역', dataIndex: '교사지역', key: '교사지역', width: 100 },
        { title: '교사팀', dataIndex: '교사팀', key: '교사팀', width: 100 },
        { title: 'Target', dataIndex: 'target', key: 'target', width: 100 },
        { title: 'Try Date', dataIndex: 'trydate', key: 'trydate', width: 120 },
    ];

    return (
        <Spin spinning={isLoading} tip="데이터 불러오는 중...">
            <div className="p-6">
                <h2 className="text-xl font-bold mb-4">Target 기준 학생 필터링</h2>

                <div className="mb-4 w-64">
                    <Select
                        allowClear
                        placeholder="Target 선택"
                        style={{ width: '100%' }}
                        value={selectedTarget ?? undefined}
                        onChange={(value) => setSelectedTarget(value ?? null)}
                    >
                        {targetOptions.map((t) => (
                            <Option key={t} value={t}>
                                {t}
                            </Option>
                        ))}
                    </Select>
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
