'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Table, Typography, Space, Input, Tabs, Collapse, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TabsProps } from 'antd';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { REGIONS } from '@/app/lib/types';

const { Title } = Typography;
const { Search } = Input;
const { Panel } = Collapse;

interface Teacher {
    고유번호: string;
    이름: string;
    지역: string;
    구역: string;
    교사형태: string;
    활동여부: string;
    c이상건수: number;
    마지막업데이트: string;
    등록사유?: string;
    fail?: boolean;
    reason?: string;
}

export default function TeacherPage() {
    const [data, setData] = useState<Teacher[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');

    useEffect(() => {
        fetch('/api/teachers')
            .then((res) => res.json())
            .then((res) => {
                setData(res);
                setLoading(false);
            })
            .catch((err) => {
                console.error('Error fetching teachers:', err);
                setLoading(false);
            });
    }, []);

    const currentTeachers = useMemo(() => data.filter((t) => !t.fail), [data]);
    const dropoutTeachers = useMemo(() => data.filter((t) => t.fail), [data]);

    const filteredData = useMemo(() => {
        const lower = searchText.toLowerCase();
        return currentTeachers.filter((t) => t.이름.toLowerCase().includes(lower));
    }, [searchText, currentTeachers]);

    const uniqueRegions = useMemo(() => Array.from(new Set(data.map((item) => item.지역))).sort(), [data]);
    const uniqueZones = useMemo(() => Array.from(new Set(data.map((item) => item.구역))).sort(), [data]);
    const uniqueTeacherTypes = useMemo(() => Array.from(new Set(data.map((item) => item.교사형태))).sort(), [data]);

    const summaryData = useMemo(() => {
        const summaryMap = new Map<
            string,
            {
                지역: string;
                팀: string;
                총: number;
                활동: number;
                비활동: number;
                탈락: number;
            }
        >();

        data.forEach((teacher) => {
            if (teacher.지역 === '국제영어' || teacher.지역 === '국제중국어') return;

            const 팀 = teacher.구역.split('-')[0] + '팀';
            const key = `${teacher.지역}.${팀}`;
            if (!summaryMap.has(key)) {
                summaryMap.set(key, {
                    지역: teacher.지역,
                    팀,
                    총: 0,
                    활동: 0,
                    비활동: 0,
                    탈락: 0,
                });
            }

            const entry = summaryMap.get(key)!;
            if (teacher.fail) {
                entry.탈락 += 1;
            } else {
                entry.총 += 1;
                if (teacher.활동여부 === '활동') entry.활동 += 1;
                else if (teacher.활동여부 === '비활동') entry.비활동 += 1;
            }
        });

        const arr = Array.from(summaryMap.values()).sort((a, b) => {
            const regionCompare = (REGIONS.indexOf(a.지역) ?? 999) - (REGIONS.indexOf(b.지역) ?? 999);
            if (regionCompare !== 0) return regionCompare;
            return a.팀.localeCompare(b.팀);
        });

        // 총합 행 생성
        const totalRow = arr.reduce(
            (acc, cur) => {
                acc.총 += cur.총;
                acc.활동 += cur.활동;
                acc.비활동 += cur.비활동;
                acc.탈락 += cur.탈락;
                return acc;
            },
            {
                지역: '총합',
                팀: '',
                총: 0,
                활동: 0,
                비활동: 0,
                탈락: 0,
            }
        );

        arr.push(totalRow);

        return arr;
    }, [data]);

    // 엑셀 내보내기 함수
    const exportToExcel = (teachers: Teacher[], fileName: string) => {
        const dataForExcel = teachers.map((t) => ({
            고유번호: t.고유번호,
            이름: t.이름,
            지역: t.지역,
            구역: t.구역,
            교사형태: t.교사형태,
            활동여부: t.활동여부,
            'C 이상 건수': t.c이상건수,
            '마지막 업데이트': t.마지막업데이트,
            등록사유: t.등록사유 ?? '',
            탈락사유: t.reason ?? '',
            fail: t.fail ?? '',
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '교사명단');

        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        saveAs(blob, fileName);
    };

    const currentColumns: ColumnsType<Teacher> = [
        {
            title: '이름',
            dataIndex: '이름',
            key: '이름',
            sorter: (a, b) => a.이름.localeCompare(b.이름),
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
            sorter: (a, b) => a.활동여부.localeCompare(b.활동여부),
            filters: [
                { text: '활동', value: '활동' },
                { text: '비활동', value: '비활동' },
            ],
            onFilter: (value, record) => record.활동여부 === value,
        },
        {
            title: 'C 이상 건수',
            dataIndex: 'c이상건수',
            key: 'c이상건수',
            sorter: (a, b) => a.c이상건수 - b.c이상건수,
        },
        {
            title: '교사형태',
            dataIndex: '교사형태',
            key: '교사형태',
            sorter: (a, b) => a.교사형태.localeCompare(b.교사형태),
            filters: uniqueTeacherTypes.map((type) => ({ text: type, value: type })),
            onFilter: (value, record) => record.교사형태 === value,
        },
        {
            title: '마지막 업데이트',
            dataIndex: '마지막업데이트',
            key: '마지막업데이트',
        },
    ];

    // 테이블 컬럼 정의 - 탈락 교사
    const dropoutColumns: ColumnsType<Teacher> = [
        {
            title: '이름',
            dataIndex: '이름',
            key: '이름',
            sorter: (a, b) => a.이름.localeCompare(b.이름),
        },
        {
            title: '지역',
            dataIndex: '지역',
            key: '지역',
            sorter: (a, b) => a.지역.localeCompare(b.지역),
        },
        {
            title: '구역',
            dataIndex: '구역',
            key: '구역',
        },
        {
            title: '교사형태',
            dataIndex: '교사형태',
            key: '교사형태',
        },
        {
            title: '탈락사유',
            dataIndex: '등록사유',
            key: '등록사유',
        },
        {
            title: '마지막 업데이트',
            dataIndex: '마지막업데이트',
            key: '마지막업데이트',
        },
    ];

    // 탭 아이템
    const items: TabsProps['items'] = [
        {
            key: 'current',
            label: '현재 교사',
            children: (
                <>
                    <Space style={{ marginBottom: 16 }}>
                        <Button type="primary" onClick={() => exportToExcel(data, '현재_교사_명단.xlsx')}>
                            현재 교사 엑셀 내보내기
                        </Button>
                        <Search
                            placeholder="이름 검색"
                            allowClear
                            onSearch={setSearchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            style={{ width: 200 }}
                        />
                    </Space>
                    <Table
                        dataSource={filteredData}
                        columns={currentColumns}
                        rowKey="고유번호"
                        bordered
                        size="middle"
                        loading={loading}
                    />
                </>
            ),
        },
        {
            key: 'dropout',
            label: '탈락 교사',
            children: (
                <>
                    <Button
                        type="primary"
                        style={{ marginBottom: 16 }}
                        onClick={() => exportToExcel(dropoutTeachers, '탈락_교사_명단.xlsx')}
                    >
                        탈락 교사 엑셀 내보내기
                    </Button>
                    <Table
                        dataSource={dropoutTeachers}
                        columns={dropoutColumns}
                        rowKey="고유번호"
                        bordered
                        size="middle"
                        loading={loading}
                    />
                </>
            ),
        },
    ];

    return (
        <div style={{ padding: 24 }}>
            <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
                <Title level={3}>교사 목록</Title>

                <Collapse defaultActiveKey={['1']} ghost>
                    <Panel header="요약 테이블 보기 / 숨기기" key="1">
                        <Table
                            dataSource={summaryData}
                            columns={[
                                { title: '지역', dataIndex: '지역', key: '지역' },
                                { title: '팀', dataIndex: '팀', key: '팀' },
                                { title: '교사 수 (탈락 제외)', dataIndex: '총', key: '총' },
                                { title: '활동 교사', dataIndex: '활동', key: '활동' },
                                { title: '비활동 교사', dataIndex: '비활동', key: '비활동' },
                                { title: '탈락 교사', dataIndex: '탈락', key: '탈락' },
                            ]}
                            rowKey={(row) => (row.지역 === '총합' ? 'total' : `${row.지역}-${row.팀}`)}
                            size="small"
                            pagination={false}
                            bordered
                            summary={() => null}
                        />
                    </Panel>
                </Collapse>

                <Tabs items={items} />
            </Space>
        </div>
    );
}
