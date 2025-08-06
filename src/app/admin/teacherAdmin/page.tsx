'use client';

import React, { useEffect, useState } from 'react';
import { Table, Input, Typography, message, Button, Card, Space, Divider } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import TeamLeaderEditor from '../components/TeamLeaderEditor';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { DownloadOutlined } from '@ant-design/icons';

// '교관' 속성 제거
interface TeacherSummaryRow {
    id: number;
    지역: string;
    팀: string;
    구역?: string;
    팀장: string;
    교사재적: number;
    활동교사: number;
    교사건: number;
    횟수3회이상: number;
    횟수2회: number;
    횟수1회: number;
    미수강: number;
}

export default function TeacherDashboard() {
    const [data, setData] = useState<TeacherSummaryRow[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        fetch('/api/teachers/teacher-summary')
            .then((res) => res.json())
            .then((result: TeacherSummaryRow[]) => {
                const grouped = groupByTeam(result);
                setData(grouped);
            })
            .catch(() => message.error('데이터를 불러오는데 실패했습니다.'))
            .finally(() => setLoading(false));
    }, []);

    // handleInputChange에서 '교관' 제거
    const handleInputChange = (value: string, index: number, key: '팀장') => {
        const newData = [...data];
        const item = newData[index];
        if (item) {
            newData[index] = { ...item, [key]: value };
            setData(newData);
        }
    };

    const groupByTeam = (rawData: TeacherSummaryRow[]): TeacherSummaryRow[] => {
        const map = new Map<string, TeacherSummaryRow>();

        rawData.forEach((row) => {
            const teamKey = row.팀 || (row.구역 ? `${row.구역.split('-')[0]}팀` : '알수없음');
            const key = `${row.지역}-${teamKey}`;

            if (!map.has(key)) {
                map.set(key, {
                    id: row.id,
                    지역: row.지역,
                    팀: teamKey,
                    팀장: row.팀장,
                    // '교관' 데이터 처리 로직 제거
                    교사재적: row.교사재적,
                    활동교사: row.활동교사,
                    교사건: row.교사건,
                    횟수3회이상: row.횟수3회이상,
                    횟수2회: row.횟수2회,
                    횟수1회: row.횟수1회,
                    미수강: row.미수강,
                });
            } else {
                const prev = map.get(key)!;
                map.set(key, {
                    ...prev,
                    교사재적: prev.교사재적 + row.교사재적,
                    활동교사: prev.활동교사 + row.활동교사,
                    교사건: prev.교사건 + row.교사건,
                    횟수3회이상: prev.횟수3회이상 + row.횟수3회이상,
                    횟수2회: prev.횟수2회 + row.횟수2회,
                    횟수1회: prev.횟수1회 + row.횟수1회,
                    미수강: prev.미수강 + row.미수강,
                });
            }
        });

        return Array.from(map.values());
    };

    const exportToExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'TeacherSummary');
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const file = new Blob([excelBuffer], { type: 'application/octet-stream' });
        saveAs(file, '교사활동현황.xlsx');
    };

    const columns: ColumnsType<TeacherSummaryRow> = [
        { title: '지역', dataIndex: '지역', key: '지역', width: 100, fixed: 'left' },
        { title: '팀', dataIndex: '팀', key: '팀', width: 120, fixed: 'left' },
        {
            title: '팀장',
            dataIndex: '팀장',
            key: '팀장',
            width: 120,
            render: (text: string, _: TeacherSummaryRow, index: number) => (
                <Input value={text} onChange={(e) => handleInputChange(e.target.value, index, '팀장')} />
            ),
        },
        // '교관' 컬럼 정의 삭제
        {
            title: '교사재적',
            dataIndex: '교사재적',
            key: '교사재적',
            width: 100,
            sorter: (a, b) => a.교사재적 - b.교사재적,
        },
        {
            title: '활동교사',
            dataIndex: '활동교사',
            key: '활동교사',
            width: 100,
            sorter: (a, b) => a.활동교사 - b.활동교사,
        },
        { title: '교사건', dataIndex: '교사건', key: '교사건', width: 100, sorter: (a, b) => a.교사건 - b.교사건 },
        {
            title: '수강 횟수',
            children: [
                { title: '3회 이상', dataIndex: '횟수3회이상', key: '횟수3회이상', width: 100 },
                { title: '2회', dataIndex: '횟수2회', key: '횟수2회', width: 80 },
                { title: '1회', dataIndex: '횟수1회', key: '횟수1회', width: 80 },
                { title: '미수강', dataIndex: '미수강', key: '미수강', width: 90 },
            ],
        },
    ];

    const calculateTotal = (dataIndex: keyof Omit<TeacherSummaryRow, '팀장' | '지역' | '팀' | '구역' | 'id'>) => {
        return data.reduce((sum, record) => sum + (Number(record[dataIndex]) || 0), 0);
    };

    return (
        <Card bordered={false}>
            <Space direction="vertical" style={{ width: '100%' }}>
                <Typography.Title level={4}>교사 활동 현황 (관리자용)</Typography.Title>
                <TeamLeaderEditor />
                <Divider />
                <Button type="primary" icon={<DownloadOutlined />} onClick={exportToExcel} style={{ marginBottom: 16 }}>
                    엑셀로 내보내기
                </Button>
                <Table
                    columns={columns}
                    dataSource={data}
                    rowKey={(row) => `${row.지역}-${row.팀}`}
                    pagination={false}
                    loading={loading}
                    bordered
                    scroll={{ x: 1200 }} // 가로 스크롤 값 조정
                    summary={() => (
                        <Table.Summary.Row style={{ backgroundColor: '#fafafa', fontWeight: 'bold' }}>
                            {/* colSpan 및 Cell index 조정 */}
                            <Table.Summary.Cell index={0} colSpan={3} align="center">
                                총합
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={3}>{calculateTotal('교사재적')}</Table.Summary.Cell>
                            <Table.Summary.Cell index={4}>{calculateTotal('활동교사')}</Table.Summary.Cell>
                            <Table.Summary.Cell index={5}>{calculateTotal('교사건')}</Table.Summary.Cell>
                            <Table.Summary.Cell index={6}>{calculateTotal('횟수3회이상')}</Table.Summary.Cell>
                            <Table.Summary.Cell index={7}>{calculateTotal('횟수2회')}</Table.Summary.Cell>
                            <Table.Summary.Cell index={8}>{calculateTotal('횟수1회')}</Table.Summary.Cell>
                            <Table.Summary.Cell index={9}>{calculateTotal('미수강')}</Table.Summary.Cell>
                        </Table.Summary.Row>
                    )}
                />
            </Space>
        </Card>
    );
}
