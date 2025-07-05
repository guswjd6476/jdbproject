'use client';
import React, { useMemo, useState } from 'react';
import { Table, Input, Button, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Students, useStudentsQuery } from '@/app/hook/useStudentsQuery';

const STEP_ORDER = ['a', 'b', 'c', 'd-1', 'd-2', 'e', 'f'];
const MIN_STEP_INDEX = STEP_ORDER.indexOf('b');

export default function RegionWiseRemarks() {
    const { data: students = [] } = useStudentsQuery();
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
    const [remarks, setRemarks] = useState<Record<string, string>>({});

    // 모든 지역 (인도자지역 + 교사지역)
    const allRegions = useMemo(() => {
        const regions = new Set<string>();
        students.forEach((s) => {
            if (s.인도자지역) regions.add(String(s.인도자지역));
            if (s.교사지역) regions.add(String(s.교사지역));
        });
        return Array.from(regions).sort();
    }, [students]);

    const filtered = useMemo(() => {
        return students.filter((s) => {
            const stepIndex = STEP_ORDER.indexOf(s.단계?.toLowerCase() ?? '');
            const isQualified = stepIndex >= MIN_STEP_INDEX;

            if (!isQualified) return false;

            // 필터 조건: B는 인도자지역, 그 이상은 교사지역
            const 기준지역 = s.단계?.toLowerCase() === 'b' ? String(s.인도자지역) : String(s.교사지역);

            return !selectedRegion || 기준지역 === selectedRegion;
        });
    }, [students, selectedRegion]);

    const handleRemarkChange = (id: string, value: string) => {
        setRemarks((prev) => ({ ...prev, [id]: value }));
    };

    const columns: ColumnsType<Students> = [
        {
            title: '이름',
            dataIndex: '이름',
            key: '이름',
            width: 100,
            render: (name: string) => {
                if (!name) return '';
                const len = name.length;
                if (len === 2) return name[0] + 'O';
                if (len === 3) return name[0] + 'O' + name[2];
                if (len >= 4) return name[0] + 'O'.repeat(len - 2) + name[len - 1];
                return name;
            },
        },
        { title: '단계', dataIndex: '단계', key: '단계', width: 80 },
        { title: '인도자지역', dataIndex: '인도자지역', key: '인도자지역', width: 100 },
        { title: '인도자팀', dataIndex: '인도자팀', key: '인도자팀', width: 100 },
        { title: '인도자이름', dataIndex: '인도자이름', key: '인도자이름', width: 100 },
        { title: '교사지역', dataIndex: '교사지역', key: '교사지역', width: 100 },
        { title: '교사팀', dataIndex: '교사팀', key: '교사팀', width: 100 },
        { title: '교사이름', dataIndex: '교사이름', key: '교사이름', width: 100 },
        {
            title: '특이사항',
            key: '특이사항',
            width: 300,
            render: (_, record) => (
                <Input.TextArea
                    rows={2}
                    placeholder="입력..."
                    value={remarks[record.id] || ''}
                    onChange={(e) => handleRemarkChange(record.id, e.target.value)}
                />
            ),
        },
    ];

    const saveRemarks = () => {
        console.log('저장할 데이터:', remarks);
        message.success('특이사항이 저장되었습니다.');
        // 실제 저장 API 호출 등 필요 시 여기에 추가
    };

    return (
        <div className="p-6">
            <h2 className="text-xl font-bold mb-4">지역별 B 이상 특이사항 관리</h2>

            <div className="mb-4 flex flex-wrap gap-2">
                <Button
                    type={!selectedRegion ? 'primary' : 'default'}
                    onClick={() => setSelectedRegion(null)}
                >
                    전체
                </Button>
                {allRegions.map((region) => (
                    <Button
                        key={region}
                        type={selectedRegion === region ? 'primary' : 'default'}
                        onClick={() => setSelectedRegion(region)}
                    >
                        {region}
                    </Button>
                ))}
            </div>

            <Table
                dataSource={filtered}
                rowKey="id"
                columns={columns}
                pagination={{ pageSize: 50 }}
                scroll={{ x: 1600 }}
                size="middle"
            />

            <div className="mt-4 text-right">
                <Button
                    type="primary"
                    onClick={saveRemarks}
                >
                    저장하기
                </Button>
            </div>
        </div>
    );
}
