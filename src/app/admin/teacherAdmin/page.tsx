'use client';

import React, { useEffect, useState } from 'react';
import { Table, Input, Typography, message, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import TeamLeaderEditor from '../components/TeamLeaderEditor';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface TeacherSummaryRow {
    id: number;
    지역: string;
    팀: string;
    구역?: string;
    팀장: string;
    교관: string;
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

    useEffect(() => {
        fetch('/api/teachers/teacher-summary')
            .then((res) => res.json())
            .then((result: TeacherSummaryRow[]) => {
                const grouped = groupByTeam(result);
                setData(grouped);
            })
            .catch(() => message.error('데이터를 불러오지 못했습니다.'));
    }, []);

    const handleInputChange = (
        value: string,
        rowIndex: number,
        key: keyof Pick<TeacherSummaryRow, '팀장' | '교관'>
    ) => {
        const newData = [...data];
        newData[rowIndex][key] = value;
        setData(newData);
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
                    교관: row.교관,
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
        { title: '지역', dataIndex: '지역', key: '지역' },
        { title: '팀', dataIndex: '팀', key: '팀' },
        {
            title: '팀장',
            dataIndex: '팀장',
            key: '팀장',
            render: (_: string, __: TeacherSummaryRow, index: number) => (
                <Input
                    value={data[index]?.팀장}
                    onChange={(e) => handleInputChange(e.target.value, index, '팀장')}
                />
            ),
        },
        {
            title: '교관',
            dataIndex: '교관',
            key: '교관',
            render: (_: string, __: TeacherSummaryRow, index: number) => (
                <Input
                    value={data[index]?.교관}
                    onChange={(e) => handleInputChange(e.target.value, index, '교관')}
                />
            ),
        },
        { title: '교사재적', dataIndex: '교사재적', key: '교사재적' },
        { title: '활동교사', dataIndex: '활동교사', key: '활동교사' },
        { title: '교사건', dataIndex: '교사건', key: '교사건' },
        { title: '3회이상', dataIndex: '횟수3회이상', key: '횟수3회이상' },
        { title: '2회', dataIndex: '횟수2회', key: '횟수2회' },
        { title: '1회', dataIndex: '횟수1회', key: '횟수1회' },
        { title: '미수강', dataIndex: '미수강', key: '미수강' },
    ];

    return (
        <>
            <Typography.Title level={4}>교사 활동 현황 (관리자용)</Typography.Title>
            <TeamLeaderEditor />
            <Button
                type="primary"
                onClick={exportToExcel}
                style={{ marginBottom: 16 }}
            >
                엑셀로 내보내기
            </Button>
            <Table
                columns={columns}
                dataSource={data}
                rowKey={(row) => `${row.지역}-${row.팀}`}
                pagination={false}
            />
        </>
    );
}
