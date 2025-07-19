'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Table, Typography, Space, Spin, Input, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;
const { Search } = Input;

interface Teacher {
    고유번호: string;
    이름: string;
    지역: string;
    구역: string;
    교사형태: string;
    활동여부: string;
    c이상건수: number;
    마지막업데이트: string;
}

export default function TeacherPage() {
    const [data, setData] = useState<Teacher[]>([]);
    const [filteredData, setFilteredData] = useState<Teacher[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchText, setSearchText] = useState('');

    useEffect(() => {
        fetch('/api/teachers')
            .then((res) => res.json())
            .then((res) => {
                setData(res);
                console.log(res, 'res???');
                setFilteredData(res);
                setLoading(false);
            })
            .catch((err) => {
                console.error('Error fetching teachers:', err);
                setLoading(false);
            });
    }, []);

    const uniqueRegions = useMemo(() => Array.from(new Set(data.map((item) => item.지역))).sort(), [data]);
    const uniqueZones = useMemo(() => Array.from(new Set(data.map((item) => item.구역))).sort(), [data]);
    const uniqueTeacherTypes = useMemo(() => Array.from(new Set(data.map((item) => item.교사형태))).sort(), [data]);

    useEffect(() => {
        let filtered = data;

        if (searchText) {
            const lower = searchText.toLowerCase();
            filtered = filtered.filter((t) => t.이름.toLowerCase().includes(lower));
        }

        setFilteredData(filtered);
    }, [data, searchText]);

    const columns: ColumnsType<Teacher> = [
        {
            title: '이름',
            dataIndex: '이름',
            key: '이름',
            sorter: (a, b) => a.이름.localeCompare(b.이름),
            sortDirections: ['ascend', 'descend'],
        },
        {
            title: '지역',
            dataIndex: '지역',
            key: '지역',
            sorter: (a, b) => a.지역.localeCompare(b.지역),
            filters: uniqueRegions.map((region) => ({ text: region, value: region })),
            onFilter: (value, record) => record.지역 === value,
        },
        {
            title: '구역',
            dataIndex: '구역',
            key: '구역',
            sorter: (a, b) => a.구역.localeCompare(b.구역),
            filters: uniqueZones.map((zone) => ({ text: zone, value: zone })),
            onFilter: (value, record) => record.구역 === value,
        },
        {
            title: '활동여부',
            dataIndex: '활동여부',
            key: '활동여부',
            filters: [
                { text: '활동', value: '활동' },
                { text: '비활동', value: '비활동' },
            ],
            onFilter: (value, record) => record.활동여부 === value,
            sorter: (a, b) => (a.활동여부 ?? '').localeCompare(b.활동여부 ?? ''),
            sortDirections: ['ascend', 'descend'],
        },
        {
            title: 'C 이상 건수',
            dataIndex: 'c이상건수',
            key: 'c이상건수',
            sorter: (a, b) => Number(a.c이상건수) - Number(b.c이상건수),
            sortDirections: ['ascend', 'descend'],
            // 숫자라서 필터는 일반적으로 안 넣음
        },
        {
            title: '교사형태',
            dataIndex: '교사형태',
            key: '교사형태',
            filters: uniqueTeacherTypes.map((type) => ({ text: type, value: type })),
            onFilter: (value, record) => record.교사형태 === value,
            sorter: (a, b) => a.교사형태.localeCompare(b.교사형태),
            sortDirections: ['ascend', 'descend'],
        },
        {
            title: '마지막 업데이트',
            dataIndex: '마지막업데이트',
            key: '마지막업데이트',
        },
    ];

    return (
        <div style={{ padding: 24 }}>
            <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
                <Title level={3}>교사 목록</Title>

                <Space wrap>
                    <Search
                        placeholder="이름 검색"
                        allowClear
                        onSearch={setSearchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        style={{ width: 200 }}
                    />
                </Space>

                {loading ? (
                    <Spin tip="로딩 중..." />
                ) : (
                    <Table dataSource={filteredData} columns={columns} rowKey="고유번호" bordered size="middle" />
                )}
            </Space>
        </div>
    );
}
