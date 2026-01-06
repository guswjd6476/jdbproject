'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Tabs, Table, Button, Space, DatePicker } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const { RangePicker } = DatePicker;

/* =========================
   타입
========================= */
interface Member {
    고유번호: string;
    이름: string;
    지역: string;
    ban: string;

    발_건수: number;
    찾_건수: number;
    합_건수: number;
    인도섭_건수: number;
    교사섭_건수: number;
    인도복_건수: number;
    교사복_건수: number;
}

interface DetailRow {
    학생고유번호?: string;
    학생명?: string;
    단계?: string;
    완료일?: string;
}

/* =========================
   숫자 정규화
========================= */
const normalizeMember = (m: any): Member => ({
    ...m,
    발_건수: Number(m.발_건수 ?? 0),
    찾_건수: Number(m.찾_건수 ?? 0),
    합_건수: Number(m.합_건수 ?? 0),
    인도섭_건수: Number(m.인도섭_건수 ?? 0),
    교사섭_건수: Number(m.교사섭_건수 ?? 0),
    인도복_건수: Number(m.인도복_건수 ?? 0),
    교사복_건수: Number(m.교사복_건수 ?? 0),
});

/* =========================
   컴포넌트
========================= */
export default function ClassCompletionViewer() {
    const [members, setMembers] = useState<Member[]>([]);
    const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
    const [activeTab, setActiveTab] = useState('class');
    const [loading, setLoading] = useState(false);

    /* =========================
     API
  ========================= */
    const fetchMembers = async (start: string, end: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/members/members-with-students?start=${start}&end=${end}`);
            if (!res.ok) throw new Error('fetchMembers 실패');

            const raw = await res.json();
            const normalized = raw.map(normalizeMember);
            setMembers(normalized);
        } finally {
            setLoading(false);
        }
    };

    const fetchDetail = async (memberId: string, start: string, end: string) => {
        const res = await fetch(`/api/members/member-detail?memberId=${memberId}&start=${start}&end=${end}`);
        if (!res.ok) throw new Error('fetchDetail 실패');
        const data = await res.json();
        setDetailRows(data);
    };

    /* =========================
     초기 로딩
  ========================= */
    useEffect(() => {
        const today = dayjs().format('YYYY-MM-DD');
        if (dateRange) {
            fetchMembers(dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD'));
        } else {
            fetchMembers(today, today);
        }
    }, [dateRange]);

    /* =========================
     반별 요약
  ========================= */
    const summary = useMemo(() => {
        const map: Record<string, any> = {};

        members.forEach((m) => {
            const key = `${m.지역}-${m.ban}`;

            if (!map[key]) {
                map[key] = {
                    지역: m.지역,
                    반: m.ban,
                    인원: 0,
                    발: 0,
                    찾: 0,
                    합: 0,
                    섭: 0,
                    복: 0,
                };
            }

            map[key].인원 += 1;
            map[key].발 += m.발_건수;
            map[key].찾 += m.찾_건수;
            map[key].합 += m.합_건수;
            map[key].섭 += m.인도섭_건수 + m.교사섭_건수;
            map[key].복 += m.인도복_건수 + m.교사복_건수;
        });

        return Object.values(map);
    }, [members]);
    const summaryColumns: ColumnsType<any> = [
        { title: '지역', dataIndex: '지역' },
        { title: '반', dataIndex: '반' },
        { title: '인원', dataIndex: '인원' },
        { title: '발', dataIndex: '발' },
        { title: '찾', dataIndex: '찾' },
        { title: '합', dataIndex: '합' },
        { title: '섭', dataIndex: '섭' },
        { title: '복', dataIndex: '복' },
    ];
    /* =========================
     엑셀
  ========================= */
    const exportExcel = () => {
        const wb = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), '반별');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(members), '개인별');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), '상세');

        const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        saveAs(
            new Blob([buf], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }),
            `결과_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`
        );
    };

    /* =========================
     컬럼
  ========================= */
    const memberColumns: ColumnsType<Member> = [
        { title: '지역', dataIndex: '지역' },
        { title: '반', dataIndex: 'ban' },
        { title: '이름', dataIndex: '이름' },

        { title: '발', dataIndex: '발_건수' },
        { title: '찾', dataIndex: '찾_건수' },
        { title: '합', dataIndex: '합_건수' },

        // ⭐ 추가된 부분
        { title: '인도섭', dataIndex: '인도섭_건수' },
        { title: '교사섭', dataIndex: '교사섭_건수' },
        { title: '인도복', dataIndex: '인도복_건수' },
        { title: '교사복', dataIndex: '교사복_건수' },

        {
            title: '상세',
            render: (_, r) => (
                <Button
                    size="small"
                    onClick={() => {
                        setSelectedMember(r);
                        setActiveTab('detail');

                        const s = (dateRange?.[0] ?? dayjs()).format('YYYY-MM-DD');
                        const e = (dateRange?.[1] ?? dayjs()).format('YYYY-MM-DD');

                        fetchDetail(r.고유번호, s, e);
                    }}
                >
                    보기
                </Button>
            ),
        },
    ];

    /* =========================
     렌더
  ========================= */
    return (
        <Space
            direction="vertical"
            style={{ width: '100%' }}
        >
            <RangePicker onChange={(v) => v && setDateRange(v as any)} />
            <Button onClick={exportExcel}>엑셀 다운로드</Button>

            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                    {
                        key: 'class',
                        label: '반별',
                        children: (
                            <Table
                                rowKey={(r) => `${r.지역}-${r.반}`}
                                dataSource={summary}
                                columns={summaryColumns} // ⭐ 이게 핵심
                                loading={loading}
                                bordered
                            />
                        ),
                    },
                    {
                        key: 'member',
                        label: '개인별',
                        children: (
                            <Table
                                rowKey="고유번호"
                                dataSource={members}
                                loading={loading}
                                bordered
                                columns={memberColumns}
                            />
                        ),
                    },
                    {
                        key: 'detail',
                        label: '상세',
                        children: (
                            <Table
                                rowKey={(_, index) => `detail-${index}`}
                                dataSource={detailRows}
                                bordered
                                columns={[
                                    { title: '학생명', dataIndex: '학생명' },
                                    { title: '단계', dataIndex: '단계' },
                                    { title: '완료일', dataIndex: '완료일' },
                                ]}
                            />
                        ),
                    },
                ]}
            />
        </Space>
    );
}
