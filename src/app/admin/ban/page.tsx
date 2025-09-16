'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button, Input, Typography, message, Space, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface MemberRow {
    고유번호: string;
    이름?: string;
    지역?: string;
    구역?: string;
    ban?: string;
    마지막업데이트?: string;
}

export default function MemberClassManager() {
    const [rawInput, setRawInput] = useState<string>(''); // 붙여넣기 입력
    const [data, setData] = useState<MemberRow[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [searchText, setSearchText] = useState<string>('');
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

    const fetchMembers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/members/set-class');
            if (!res.ok) throw new Error('데이터 조회 실패');
            const members: MemberRow[] = await res.json();
            setData(members);
        } catch (err: any) {
            message.error(err.message || '데이터 불러오기 오류');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMembers();
    }, []);

    const parseInput = (input: string): MemberRow[] => {
        return input
            .trim()
            .split('\n')
            .map((line) => {
                const [고유번호, ban] = line.trim().split(/\s+/);
                return { 고유번호, ban };
            })
            .filter((row) => row.고유번호 && row.ban);
    };

    const handleUpload = async () => {
        const parsed = parseInput(rawInput);
        if (parsed.length === 0) {
            message.warning('입력값을 확인해주세요. (예: 00351126-00667 1반)');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/members/set-class', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '업로드 실패');
            }

            const updated: MemberRow[] = await res.json();
            setData((prev) => {
                const map = new Map(prev.map((m) => [m.고유번호, m]));
                updated.forEach((u) => map.set(u.고유번호, { ...map.get(u.고유번호), ...u }));
                return Array.from(map.values());
            });
            setRawInput('');
            message.success('반 배정이 완료되었습니다.');
        } catch (err: any) {
            message.error(err.message || '업로드 중 오류');
        } finally {
            setLoading(false);
        }
    };

    const updateSingleClass = async (record: MemberRow, ban: string) => {
        setLoading(true);
        try {
            const res = await fetch('/api/members/set-class', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 고유번호: record.고유번호, ban }),
            });

            if (!res.ok) throw new Error('업데이트 실패');
            const [updated] = await res.json();
            setData((prev) => prev.map((m) => (m.고유번호 === updated.고유번호 ? { ...m, ban: updated.ban } : m)));
            message.success(`${record.이름} 반이 수정되었습니다.`);
        } catch (err: any) {
            message.error(err.message || '업데이트 오류');
        } finally {
            setLoading(false);
        }
    };

    // 검색 필터
    const filteredData = useMemo(() => {
        if (!searchText) return data;
        const lower = searchText.toLowerCase();
        return data.filter(
            (row) =>
                (row.고유번호?.toLowerCase().includes(lower) ?? false) ||
                (row.이름?.toLowerCase().includes(lower) ?? false) ||
                (row.지역?.toLowerCase().includes(lower) ?? false) ||
                (row.구역?.toLowerCase().includes(lower) ?? false) ||
                (row.ban?.toLowerCase().includes(lower) ?? false)
        );
    }, [data, searchText]);

    // 테이블 컬럼
    const columns: ColumnsType<MemberRow> = [
        { title: '고유번호', dataIndex: '고유번호', key: '고유번호' },
        { title: '이름', dataIndex: '이름', key: '이름' },
        { title: '지역', dataIndex: '지역', key: '지역' },
        { title: '구역', dataIndex: '구역', key: '구역' },
        {
            title: '반',
            dataIndex: 'ban',
            key: 'ban',
            render: (value: string, record) => (
                <Select value={value || ''} style={{ width: 100 }} onChange={(v) => updateSingleClass(record, v)}>
                    <Select.Option value="">미배정</Select.Option>
                    <Select.Option value="1반">1반</Select.Option>
                    <Select.Option value="2반">2반</Select.Option>
                    <Select.Option value="3반">3반</Select.Option>
                    <Select.Option value="4반">4반</Select.Option>
                    <Select.Option value="5반">5반</Select.Option>
                    <Select.Option value="6반">6반</Select.Option>
                    <Select.Option value="7반">7반</Select.Option>
                    <Select.Option value="8반">8반</Select.Option>
                </Select>
            ),
        },
        { title: '마지막업데이트', dataIndex: '마지막업데이트', key: '마지막업데이트' },
    ];

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <Typography.Title level={3}>멤버 반 배정</Typography.Title>

            <Typography.Paragraph type="secondary">
                <strong>붙여넣기 예시:</strong>
                <br />
                <code>00310000-00111 1반</code>
                <br />
                고유번호와 반을 띄어쓰기로 구분해 주세요.
            </Typography.Paragraph>

            <Input.TextArea
                rows={6}
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="고유번호 반"
                disabled={loading}
            />

            <Button type="primary" onClick={handleUpload} loading={loading} className="my-4">
                업로드 및 반 배정
            </Button>

            <Space direction="vertical" style={{ width: '100%' }} size="middle" className="mb-4">
                <Input.Search
                    placeholder="고유번호, 이름, 지역, 구역, 반 검색"
                    allowClear
                    enterButton
                    onSearch={(value) => setSearchText(value)}
                    onChange={(e) => {
                        if (e.target.value === '') setSearchText('');
                    }}
                    disabled={loading}
                />
            </Space>

            <Table
                columns={columns}
                dataSource={filteredData}
                rowKey={(record) => record.고유번호}
                loading={loading}
                bordered
                pagination={{ pageSize: 20 }}
                rowSelection={{
                    type: 'checkbox',
                    selectedRowKeys: selectedKeys,
                    onChange: (keys) => setSelectedKeys(keys as string[]),
                }}
            />
        </div>
    );
}
