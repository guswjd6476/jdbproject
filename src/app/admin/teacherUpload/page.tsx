'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button, Input, Typography, message, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface TeacherRow {
    고유번호: string;
    등록구분: string;
    이름?: string;
    지역?: string;
    구역?: string;
    교사형태?: string;
    fail?: boolean;
    reason?: string;
    마지막업데이트?: string;
}

export default function TeacherUploadPage() {
    const [rawInput, setRawInput] = useState<string>('');
    const [data, setData] = useState<TeacherRow[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [searchText, setSearchText] = useState<string>('');
    const [dropoutKey, setDropoutKey] = useState<string | null>(null);
    const [deleteKeys, setDeleteKeys] = useState<string[]>([]);

    const fetchTeachers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/teachers');
            if (!res.ok) throw new Error('데이터 조회 실패');
            const teachers: TeacherRow[] = await res.json();
            setData(teachers);
        } catch (err: any) {
            message.error(err.message || '데이터를 불러오는 중 오류 발생');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTeachers();
    }, []);

    const parseInput = (input: string): TeacherRow[] => {
        return input
            .trim()
            .split('\n')
            .map((line) => {
                const [고유번호, 등록구분] = line.trim().split(/\s+/);
                return { 고유번호, 등록구분 };
            })
            .filter((row) => row.고유번호 && row.등록구분);
    };

    const handleUpload = async () => {
        const parsed = parseInput(rawInput);
        if (parsed.length === 0) {
            message.warning('입력값을 확인해주세요.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/teachers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '업로드 실패');
            }

            const resData: TeacherRow[] = await res.json();
            setData(resData);
            setRawInput('');
            message.success('업로드 완료');
        } catch (err: any) {
            message.error(err.message || '에러 발생');
        } finally {
            setLoading(false);
        }
    };

    const handleDropout = async () => {
        if (!dropoutKey) {
            message.warning('탈락할 교사를 선택하세요.');
            return;
        }

        const teacher = data.find((t) => t.고유번호 + t.등록구분 === dropoutKey);
        if (!teacher) {
            message.error('교사를 찾을 수 없습니다.');
            return;
        }

        const 사유 = prompt('탈락 사유를 입력하세요:');
        if (!사유) return;

        setLoading(true);
        try {
            const res = await fetch('/api/teachers/dropout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 고유번호: teacher.고유번호, 사유 }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '탈락 실패');
            }

            const updatedData: TeacherRow[] = await res.json();
            setData(updatedData);
            setDropoutKey(null);
            message.success('탈락 처리 완료');
        } catch (err: any) {
            message.error(err.message || '탈락 중 오류');
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async () => {
        if (deleteKeys.length === 0) {
            message.warning('복귀할 교사를 선택하세요.');
            return;
        }

        const confirmed = confirm(`${deleteKeys.length}명 복귀하시겠습니까?`);
        if (!confirmed) return;

        setLoading(true);
        try {
            const res = await fetch('/api/teachers/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keys: deleteKeys }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '삭제 실패');
            }

            const updatedData: TeacherRow[] = await res.json();
            setData(updatedData);
            setDeleteKeys([]);
            message.success('삭제 완료');
        } catch (err: any) {
            message.error(err.message || '삭제 중 오류');
        } finally {
            setLoading(false);
        }
    };
    const handleDelete = async () => {
        if (deleteKeys.length === 0) {
            message.warning('삭제할 교사를 선택하세요.');
            return;
        }

        const confirmed = confirm(`${deleteKeys.length}명 삭제하시겠습니까?`);
        if (!confirmed) return;

        setLoading(true);
        try {
            const res = await fetch('/api/teachers/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keys: deleteKeys }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '삭제 실패');
            }

            const updatedData: TeacherRow[] = await res.json();
            setData(updatedData);
            setDeleteKeys([]);
            message.success('삭제 완료');
        } catch (err: any) {
            message.error(err.message || '삭제 중 오류');
        } finally {
            setLoading(false);
        }
    };
    console.log(deleteKeys, '?d');
    const filteredData = useMemo(() => {
        if (!searchText) return data;
        const lower = searchText.toLowerCase();
        return data.filter(
            (row) =>
                row.고유번호.toLowerCase().includes(lower) ||
                (row.이름?.toLowerCase().includes(lower) ?? false) ||
                (row.지역?.toLowerCase().includes(lower) ?? false) ||
                (row.구역?.toLowerCase().includes(lower) ?? false) ||
                (row.교사형태?.toLowerCase().includes(lower) ?? false)
        );
    }, [data, searchText]);

    const isSelectedTeacherFailed = () => {
        if (!dropoutKey) return false;
        const teacher = data.find((t) => t.고유번호 + t.등록구분 === dropoutKey);
        return teacher?.fail ?? false;
    };

    const columns: ColumnsType<TeacherRow> = [
        { title: '고유번호', dataIndex: '고유번호', key: '고유번호' },
        { title: '이름', dataIndex: '이름', key: '이름' },
        { title: '지역', dataIndex: '지역', key: '지역' },
        { title: '구역', dataIndex: '구역', key: '구역' },
        { title: '교사형태', dataIndex: '교사형태', key: '교사형태' },
        {
            title: '탈락',
            key: 'reason',
            render: (_, record) => record.reason,
        },
        { title: '마지막업데이트', dataIndex: '마지막업데이트', key: '마지막업데이트' },
    ];

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <Typography.Title level={3}>교사 명단 관리</Typography.Title>

            <Typography.Paragraph type="secondary">
                <strong>붙여넣기 예시:</strong>
                <br />
                <code>00351126-00667 교사이수</code>
                <br />
                고유번호와 등록구분을 띄어쓰기로 구분해 주세요.
            </Typography.Paragraph>

            <Input.TextArea
                rows={6}
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="고유번호 등록구분"
                disabled={loading}
            />

            <Button
                type="primary"
                onClick={handleUpload}
                loading={loading}
                className="my-4"
            >
                업로드 및 조회
            </Button>

            <Space
                direction="vertical"
                style={{ width: '100%' }}
                size="middle"
                className="mb-4"
            >
                <Input.Search
                    placeholder="고유번호, 이름, 지역 등으로 검색"
                    allowClear
                    enterButton
                    onSearch={(value) => setSearchText(value)}
                    onChange={(e) => {
                        if (e.target.value === '') setSearchText('');
                    }}
                    disabled={loading}
                />

                <Space wrap>
                    <Button
                        danger
                        onClick={handleDropout}
                        disabled={!dropoutKey || loading}
                    >
                        선택 교사 탈락처리
                    </Button>

                    <Button
                        type="default"
                        onClick={handleRestore}
                        disabled={deleteKeys.length === 0 || loading}
                    >
                        선택 교사 복귀처리
                    </Button>

                    <Button
                        type="default"
                        onClick={handleDelete}
                        disabled={deleteKeys.length === 0 || loading}
                    >
                        선택 교사 삭제
                    </Button>
                </Space>
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
                    selectedRowKeys: deleteKeys,
                    onChange: (selectedKeys) => {
                        setDeleteKeys(selectedKeys as string[]);
                        if (selectedKeys.length === 1) {
                            setDropoutKey(String(selectedKeys[0]));
                        } else {
                            setDropoutKey(null);
                        }
                    },
                }}
            />
        </div>
    );
}
