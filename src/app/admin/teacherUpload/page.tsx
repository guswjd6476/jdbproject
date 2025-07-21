'use client';

import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface TeacherRow {
    고유번호: string;
    등록구분: string;
    이름?: string;
    지역?: string;
    구역?: string;
    교사형태?: string;
    마지막업데이트?: string;
    등록사유?: string;
    fail?: boolean;
}

export default function TeacherUpload() {
    const [rawText, setRawText] = useState('');
    const [rows, setRows] = useState<TeacherRow[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchTeachers = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/teachers');
            if (!res.ok) throw new Error('조회 실패');
            const data: TeacherRow[] = await res.json();
            setRows(data);
        } catch (err) {
            message.error(`오류: ${(err as Error).message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTeachers();
    }, []);

    const handleProcess = async () => {
        setLoading(true);

        const parsed = rawText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                const [id, type] = line.split(/\s+/);
                return { 고유번호: id, 등록구분: type };
            });

        try {
            const postRes = await fetch('/api/teachers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed),
            });

            if (!postRes.ok) {
                let errMsg = '저장 실패';
                try {
                    const err = await postRes.json();
                    errMsg = err.error ?? errMsg;
                } catch {}
                throw new Error(errMsg);
            }

            await fetchTeachers();
            setRawText('');
        } catch (error) {
            message.error(`오류 발생: ${(error as Error).message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDropout = async (고유번호: string) => {
        const 사유 = prompt('탈락 사유를 입력하세요:');
        if (!사유) return;

        try {
            setLoading(true);
            const res = await fetch('/api/teachers/dropout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 고유번호, 사유 }),
            });

            if (!res.ok) throw new Error('탈락 처리 실패');

            await fetchTeachers();
        } catch (err) {
            message.error(`오류: ${(err as Error).message}`);
        } finally {
            setLoading(false);
        }
    };

    const columns: ColumnsType<TeacherRow> = [
        {
            title: '고유번호',
            dataIndex: '고유번호',
            key: '고유번호',
            sorter: (a, b) => a.고유번호.localeCompare(b.고유번호),
        },
        {
            title: '이름',
            dataIndex: '이름',
            key: '이름',
            sorter: (a, b) => (a.이름 ?? '').localeCompare(b.이름 ?? ''),
        },
        {
            title: '지역',
            dataIndex: '지역',
            key: '지역',
            sorter: (a, b) => (a.지역 ?? '').localeCompare(b.지역 ?? ''),
        },
        {
            title: '구역',
            dataIndex: '구역',
            key: '구역',
            sorter: (a, b) => (a.구역 ?? '').localeCompare(b.구역 ?? ''),
        },
        {
            title: '교사형태',
            dataIndex: '교사형태',
            key: '교사형태',
            sorter: (a, b) => (a.교사형태 ?? '').localeCompare(b.교사형태 ?? ''),
            render: (_, row) => (row.fail ? `${row.교사형태 ?? ''}(탈락)` : row.교사형태 ?? ''),
        },
        {
            title: '마지막업데이트',
            dataIndex: '마지막업데이트',
            key: '마지막업데이트',
            sorter: (a, b) => (a.마지막업데이트 ?? '').localeCompare(b.마지막업데이트 ?? ''),
        },
        {
            title: '탈락사유',
            dataIndex: 'reason',
            key: 'reason',
            sorter: (a, b) => (a.등록사유 ?? '').localeCompare(b.등록사유 ?? ''),
        },
        {
            title: '탈락처리',
            key: 'action',
            sorter: (a, b) => (a.등록사유 ?? '').localeCompare(b.등록사유 ?? ''),
            render: (_, row) =>
                row.fail ? (
                    <span style={{ color: 'red' }}>탈락</span>
                ) : (
                    <Button
                        size="small"
                        danger
                        onClick={() => handleDropout(row.고유번호)}
                    >
                        탈락처리
                    </Button>
                ),
        },
    ];

    return (
        <div className="p-4">
            <Typography.Title level={4}>교사 명단 붙여넣기</Typography.Title>
            <Input.TextArea
                rows={8}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="고유번호 [탭 또는 공백] 등록구분 붙여넣기"
                disabled={loading}
                className="mb-2"
            />
            <Button
                type="primary"
                onClick={handleProcess}
                loading={loading}
                className="mb-4"
            >
                저장 및 조회
            </Button>

            <Table
                dataSource={rows}
                columns={columns}
                rowKey="고유번호"
                loading={loading}
                bordered
            />
        </div>
    );
}
