'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Table, message, Typography, Button, Popconfirm } from 'antd';
import type { ColumnsType } from 'antd/es/table';

type Student = {
    번호: number;
    이름: string;
    연락처?: string;
    생년월일?: string;
    인도자?: string;
    인도자지역?: string;
    인도자팀?: string;
    인도자이름?: string;
    단계?: string;
    a?: string;
    b?: string;
    c?: string;
    'd-1'?: string;
    'd-2'?: string;
    e?: string;
    f?: string;
    센확?: string;
    g?: string;
    [key: string]: string | number | undefined;
};

export default function DuplicateStudentByNameAndLeader() {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/students');
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
        fetchStudents();
    }, []);

    const duplicateStudents = useMemo(() => {
        const map = new Map<string, Student[]>();

        for (const student of students) {
            const name = student.이름?.trim() || '';
            const leaderName = student.인도자이름?.trim() || ''; // 인도자이름 기준
            const key = `${name}__${leaderName}`;

            if (!map.has(key)) {
                map.set(key, []);
            }
            map.get(key)?.push(student);
        }

        return Array.from(map.values()).flatMap((group) => (group.length > 1 ? group : []));
    }, [students]);

    const handleDeleteSelected = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning('삭제할 학생을 선택하세요.');
            return;
        }

        try {
            const res = await fetch('/api/students/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedRowKeys }),
            });

            if (!res.ok) throw new Error();
            message.success('삭제 완료');
            setSelectedRowKeys([]);
            fetchStudents();
        } catch {
            message.error('삭제 실패');
        }
    };

    const renderDate = (value: string | null | undefined) =>
        value ? new Date(value).toLocaleDateString('ko-KR') : '-';

    const columns: ColumnsType<Student> = [
        { title: '번호', dataIndex: '번호', key: '번호', width: 30 },
        { title: '이름', dataIndex: '이름', key: '이름', width: 50 },
        { title: '연락처', dataIndex: '연락처', key: '연락처', width: 50 },
        { title: '생년월일', dataIndex: '생년월일', key: '생년월일', width: 60 },
        { title: '인도자 지역', dataIndex: '인도자지역', key: '인도자지역', width: 50 },
        { title: '인도자 팀', dataIndex: '인도자팀', key: '인도자팀', width: 50 },
        { title: '인도자 이름', dataIndex: '인도자이름', key: '인도자이름', width: 50 },
        { title: '단계', dataIndex: '단계', key: '단계', width: 80 },
        { title: 'A', dataIndex: 'a', key: 'a', width: 110, render: renderDate },
        { title: 'B', dataIndex: 'b', key: 'b', width: 110, render: renderDate },
        { title: 'C', dataIndex: 'c', key: 'c', width: 110, render: renderDate },
        { title: 'D-1', dataIndex: 'd-1', key: 'd-1', width: 110, render: renderDate },
        { title: 'D-2', dataIndex: 'd-2', key: 'd-2', width: 110, render: renderDate },
        { title: 'E', dataIndex: 'e', key: 'e', width: 110, render: renderDate },
        { title: 'F', dataIndex: 'f', key: 'f', width: 110, render: renderDate },
        { title: '센확', dataIndex: '센확', key: '센확', width: 110, render: renderDate },
        { title: '탈락일', dataIndex: 'g', key: 'g', width: 110, render: renderDate },
    ];

    return (
        <div className="p-4">
            <Typography.Title level={3}>이름 + 인도자 기준 중복 학생 명단</Typography.Title>

            <div className="mb-4 flex gap-2">
                <Popconfirm
                    title="선택한 학생들을 삭제하시겠습니까?"
                    onConfirm={handleDeleteSelected}
                    okText="삭제"
                    cancelText="취소"
                    disabled={selectedRowKeys.length === 0}
                >
                    <Button danger disabled={selectedRowKeys.length === 0}>
                        선택 삭제
                    </Button>
                </Popconfirm>
                <span>{selectedRowKeys.length}명 선택됨</span>
            </div>

            <Table
                dataSource={duplicateStudents}
                columns={columns}
                rowKey="번호"
                loading={loading}
                pagination={{ pageSize: 100 }}
                scroll={{ x: 2400 }}
                rowSelection={{
                    selectedRowKeys,
                    onChange: (selected) => setSelectedRowKeys(selected),
                }}
            />
        </div>
    );
}
