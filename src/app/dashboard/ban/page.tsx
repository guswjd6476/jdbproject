'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { Table, Button, Space, DatePicker, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

interface MemberWithStudent {
    고유번호: string;
    이름: string;
    지역: string;
    ban: string;
    발_건수?: number;
    찾_건수?: number;
    합_건수?: number;
    섭_건수?: number;
    복_건수?: number;
}

export default function ClassCompletionViewer() {
    const [members, setMembers] = useState<MemberWithStudent[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
    const [activeTab, setActiveTab] = useState('summary');

    const fetchMembers = async (start?: string, end?: string) => {
        setLoading(true);
        try {
            let url = '/api/members/members-with-students';
            if (start && end) url += `?start=${start}&end=${end}`;
            const res = await fetch(url);
            const data: MemberWithStudent[] = await res.json();
            setMembers(data.filter((m) => m.ban));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (dateRange) {
            fetchMembers(dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD'));
        } else {
            const today = dayjs().format('YYYY-MM-DD');
            fetchMembers(today, today);
        }
    }, [dateRange]);
    const summary = useMemo(() => {
        const result: Record<
            string,
            { 지역: string; 반: string; 총인원: number; 발: number; 찾: number; 합: number; 섭: number; 복: number }
        > = {};

        members.forEach((m) => {
            const key = `${m.지역}-${m.ban}`;
            if (!result[key]) result[key] = { 지역: m.지역, 반: m.ban, 총인원: 0, 발: 0, 찾: 0, 합: 0, 섭: 0, 복: 0 };

            result[key].총인원 += 1;

            // 숫자로 변환
            const 발 = Number(m.발_건수 ?? 0);
            const 찾 = Number(m.찾_건수 ?? 0);
            const 합 = Number(m.합_건수 ?? 0);
            const 섭 = Number(m.섭_건수 ?? 0);
            const 복 = Number(m.복_건수 ?? 0);

            result[key].발 += 발;
            result[key].찾 += 찾;
            result[key].합 += 합;
            result[key].섭 += 섭;
            result[key].복 += 복;
        });

        return Object.values(result);
    }, [members]);

    // 선택된 반의 개별 명단
    const selectedMembers = useMemo(() => {
        if (!selectedKey) return [];
        return members.filter((m) => `${m.지역}-${m.ban}` === selectedKey);
    }, [members, selectedKey]);

    const summaryColumns: ColumnsType<any> = [
        { title: '지역', dataIndex: '지역', key: '지역' },
        {
            title: '반',
            dataIndex: '반',
            key: '반',
            render: (_text: string, record: any) => {
                const key = `${record.지역}-${record.반}`;
                return (
                    <Button
                        type={selectedKey === key ? 'primary' : 'default'}
                        onClick={() => setSelectedKey(key)}
                    >
                        {record.반}
                    </Button>
                );
            },
        },
        { title: '총 인원', dataIndex: '총인원', key: '총인원' },
        { title: '발 완료', dataIndex: '발', key: '발' },
        { title: '찾 완료', dataIndex: '찾', key: '찾' },
        { title: '합 완료', dataIndex: '합', key: '합' },
        { title: '섭 완료', dataIndex: '섭', key: '섭' },
        { title: '복 완료', dataIndex: '복', key: '복' },
    ];

    const memberColumns: ColumnsType<MemberWithStudent> = [
        { title: '지역', dataIndex: '지역', key: '지역' },
        { title: '반', dataIndex: 'ban', key: 'ban' },
        { title: '이름', dataIndex: '이름', key: '이름' },
        { title: '발 완료', dataIndex: '발_건수', key: '발_건수' },
        { title: '찾 완료', dataIndex: '찾_건수', key: '찾_건수' },
        { title: '합 완료', dataIndex: '합_건수', key: '합_건수' },
        { title: '섭 완료', dataIndex: '섭_건수', key: '섭_건수' },
        { title: '복 완료', dataIndex: '복_건수', key: '복_건수' },
    ];

    const handleExport = (data: any[]) => {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '명단');
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        saveAs(
            new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
            `명단_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`
        );
    };

    return (
        <div className="p-4 max-w-full space-y-4">
            <Space
                direction="vertical"
                style={{ width: '100%' }}
            >
                <RangePicker
                    onChange={(dates) => {
                        // null 체크 후 타입 안전하게 설정
                        if (dates && dates[0] && dates[1]) setDateRange([dates[0], dates[1]]);
                        else setDateRange(null);
                    }}
                    format="YYYY-MM-DD"
                />
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                >
                    <TabPane
                        tab="반별 요약"
                        key="summary"
                    >
                        <Button onClick={() => handleExport(summary)}>엑셀로 내보내기</Button>
                        <Table
                            rowKey={(record) => `${record.지역}-${record.반}`}
                            columns={summaryColumns}
                            dataSource={summary}
                            loading={loading}
                            pagination={false}
                            bordered
                        />
                        {selectedKey && (
                            <>
                                <h3>{selectedKey} 명단</h3>
                                <Table
                                    rowKey="고유번호"
                                    columns={memberColumns}
                                    dataSource={selectedMembers}
                                    loading={loading}
                                    pagination={{ pageSize: 50 }}
                                    bordered
                                />
                            </>
                        )}
                    </TabPane>
                    <TabPane
                        tab="전체 명단"
                        key="all"
                    >
                        <Button onClick={() => handleExport(members)}>엑셀로 내보내기</Button>
                        <Table
                            rowKey="고유번호"
                            columns={memberColumns}
                            dataSource={members}
                            loading={loading}
                            pagination={{ pageSize: 50 }}
                            bordered
                        />
                    </TabPane>
                </Tabs>
            </Space>
        </div>
    );
}
