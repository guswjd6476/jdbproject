'use client';

import React, { useEffect, useState } from 'react';
import { Table, Input, Typography, Button, message, Space, Spin, Popconfirm, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';

const { Option } = Select;

interface TeamLeaderRow {
    지역: string;
    팀: string;
    팀장: string;
    교관: string;
}

const REGION_OPTIONS = ['도봉', '성북', '노원', '중랑', '강북', '대학', '새신자'];

export default function TeamLeaderEditor() {
    const [data, setData] = useState<TeamLeaderRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [edited, setEdited] = useState(false); // 변경 여부 추적

    useEffect(() => {
        setLoading(true);
        fetch('/api/members/teamleader')
            .then((res) => res.json())
            .then((result: TeamLeaderRow[]) => {
                setData([...result, { 지역: '', 팀: '', 팀장: '', 교관: '' }]);
                setEdited(false);
            })
            .catch(() => message.error('팀장/교관 데이터를 불러오지 못했습니다.'))
            .finally(() => setLoading(false));
    }, []);

    const handleInputChange = (value: string, rowIndex: number, key: keyof TeamLeaderRow) => {
        setData((prev) => {
            const newData = [...prev];
            newData[rowIndex] = { ...newData[rowIndex], [key]: value };
            return newData;
        });
        setEdited(true);
    };

    const handleDeleteRow = (rowIndex: number) => {
        const newData = [...data];
        newData.splice(rowIndex, 1);
        setData(newData);
        setEdited(true);
    };

    const handleAddRow = () => {
        setData([...data, { 지역: '', 팀: '', 팀장: '', 교관: '' }]);
        setEdited(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = data.filter((row) => row.지역.trim() !== '' && row.팀.trim() !== '');
            const res = await fetch('/api/members/teamleader', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error('저장 실패');
            message.success('팀장/교관 정보가 저장되었습니다.');
            setEdited(false);
        } catch {
            message.error('저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const columns: ColumnsType<TeamLeaderRow> = [
        {
            title: '지역',
            dataIndex: '지역',
            key: '지역',
            render: (_: string, __: TeamLeaderRow, index: number) => (
                <Select
                    placeholder="지역 선택"
                    value={data[index]?.지역 || undefined}
                    onChange={(value) => handleInputChange(value, index, '지역')}
                    style={{ width: 120 }}
                    allowClear
                >
                    {REGION_OPTIONS.map((region) => (
                        <Option key={region} value={region}>
                            {region}
                        </Option>
                    ))}
                </Select>
            ),
        },
        {
            title: '팀',
            dataIndex: '팀',
            key: '팀',
            render: (_: string, __: TeamLeaderRow, index: number) => (
                <Input
                    placeholder="팀 입력 (예: 1-1)"
                    value={data[index]?.팀}
                    onChange={(e) => handleInputChange(e.target.value, index, '팀')}
                />
            ),
        },
        {
            title: '팀장',
            dataIndex: '팀장',
            key: '팀장',
            render: (_: string, __: TeamLeaderRow, index: number) => (
                <Input
                    placeholder="팀장 이름 입력"
                    value={data[index]?.팀장}
                    onChange={(e) => handleInputChange(e.target.value, index, '팀장')}
                />
            ),
        },
        {
            title: '교관',
            dataIndex: '교관',
            key: '교관',
            render: (_: string, __: TeamLeaderRow, index: number) => (
                <Input
                    placeholder="교관 이름 입력"
                    value={data[index]?.교관}
                    onChange={(e) => handleInputChange(e.target.value, index, '교관')}
                />
            ),
        },
        {
            title: '액션',
            key: 'action',
            render: (_: any, __: TeamLeaderRow, index: number) => (
                <Popconfirm
                    title="이 행을 삭제하시겠습니까?"
                    onConfirm={() => handleDeleteRow(index)}
                    okText="네"
                    cancelText="아니오"
                    disabled={data.length === 1}
                >
                    <Button danger disabled={data.length === 1}>
                        삭제
                    </Button>
                </Popconfirm>
            ),
        },
    ];

    if (loading) return <Spin tip="데이터 로딩 중..." />;

    return (
        <>
            <Typography.Title level={4}>팀장/교관 편집 (관리자 전용)</Typography.Title>
            <Table
                columns={columns}
                dataSource={data}
                rowKey={(row, index) => `${row.지역}-${row.팀}-${index}`}
                pagination={false}
            />
            <Space style={{ marginTop: 16 }}>
                <Button onClick={handleAddRow}>행 추가</Button>
                <Button type="primary" onClick={handleSave} loading={saving} disabled={!edited}>
                    저장하기
                </Button>
            </Space>
        </>
    );
}
