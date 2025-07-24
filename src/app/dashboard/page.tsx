'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Table, InputNumber, Input, Button, Form, message, Typography } from 'antd';
import { useUser } from '@/app/hook/useUser';

interface RowData {
    month: number;
    region: string;
    a: number;
    b: number;
    c: number;
    d_1: number;
    d_2: number;
    f: number;
    센확: number;
    센등: number;
    aToB?: number;
    bToC?: number;
    cToD1?: number;
    d1ToF?: number;
    isTotal?: boolean;
}

export default function MonthlyDashboard() {
    const [data, setData] = useState<RowData[]>([]);
    const [form] = Form.useForm();
    const [editingKey, setEditingKey] = useState<string>('');
    const { isAdmin } = useUser();

    useEffect(() => {
        fetch('/api/monthly')
            .then((res) => res.json())
            .then((res) => setData(res));
    }, []);

    const handleAddOrUpdate = async (values: any) => {
        const key = `${values.month}-${values.region}`;
        const exists = data.find((d) => `${d.month}-${d.region}` === key);

        if (exists && editingKey !== key) {
            message.warning('이미 입력된 월/지역입니다.');
            return;
        }

        const newData = data.filter((d) => `${d.month}-${d.region}` !== key);
        const updatedRow: RowData = {
            ...values,
            a: values.a || 0,
            b: values.b || 0,
            c: values.c || 0,
            d_1: values.d_1 || 0,
            d_2: values.d_2 || 0,
            f: values.f || 0,
            센확: values.센확 || 0,
            센등: values.센등 || 0,
        };

        setData([...newData, updatedRow]);
        setEditingKey('');
        form.resetFields();
    };

    const enhancedData = useMemo(() => {
        if (data.length === 0) return [];

        const monthMap: Record<number, RowData[]> = {};
        data.forEach((row) => {
            if (!monthMap[row.month]) monthMap[row.month] = [];
            monthMap[row.month].push(row);
        });

        const result: RowData[] = [];

        Object.entries(monthMap).forEach(([monthStr, rows]) => {
            const month = Number(monthStr);
            let sumA = 0,
                sumB = 0,
                sumC = 0,
                sumD1 = 0,
                sumD2 = 0,
                sumF = 0,
                sum센확 = 0,
                sum센등 = 0;

            const rowsWithRates = rows.map((row) => {
                const newRow = {
                    ...row,
                    aToB: row.a ? (row.b / row.a) * 100 : 0,
                    bToC: row.b ? (row.c / row.b) * 100 : 0,
                    cToD1: row.c ? (row.d_1 / row.c) * 100 : 0,
                    d1ToF: row.d_1 ? (row.f / row.d_1) * 100 : 0,
                };
                sumA += row.a;
                sumB += row.b;
                sumC += row.c;
                sumD1 += row.d_1;
                sumD2 += row.d_2;
                sumF += row.f;
                sum센확 += row.센확;
                sum센등 += row.센등;
                return newRow;
            });

            const totalRow: RowData = {
                month,
                region: '총합',
                a: sumA,
                b: sumB,
                c: sumC,
                d_1: sumD1,
                d_2: sumD2,
                f: sumF,
                센확: sum센확,
                센등: sum센등,
                aToB: sumA ? (sumB / sumA) * 100 : 0,
                bToC: sumB ? (sumC / sumB) * 100 : 0,
                cToD1: sumC ? (sumD1 / sumC) * 100 : 0,
                d1ToF: sumD1 ? (sumF / sumD1) * 100 : 0,
                isTotal: true,
            };

            result.push(...rowsWithRates, totalRow);
        });

        return result;
    }, [data]);

    const columns = [
        { title: '월', dataIndex: 'month', sorter: (a: any, b: any) => a.month - b.month, width: 70 },
        { title: '지역', dataIndex: 'region', width: 80 },
        { title: 'A', dataIndex: 'a', width: 80 },
        { title: 'B', dataIndex: 'b', width: 60 },
        { title: 'C', dataIndex: 'c', width: 60 },
        { title: 'D-1', dataIndex: 'd_1', width: 60 },
        { title: 'D-2', dataIndex: 'd_2', width: 60 },
        { title: 'F', dataIndex: 'f', width: 60 },
        { title: '센확', dataIndex: '센확', width: 60 },
        { title: '센등', dataIndex: '센등', width: 60 },
        {
            title: 'A→B(%)',
            dataIndex: 'aToB',
            render: (v: number) => v?.toFixed(1),
        },
        {
            title: 'B→C(%)',
            dataIndex: 'bToC',
            render: (v: number) => v?.toFixed(1),
        },
        {
            title: 'C→D-1(%)',
            dataIndex: 'cToD1',
            render: (v: number) => v?.toFixed(1),
        },
        {
            title: 'D-1→F(%)',
            dataIndex: 'd1ToF',
            render: (v: number) => v?.toFixed(1),
        },
        {
            title: '수정',
            dataIndex: 'edit',
            render: (_: any, row: RowData) =>
                isAdmin &&
                !row.isTotal && (
                    <Button
                        type="link"
                        onClick={() => {
                            form.setFieldsValue(row);
                            setEditingKey(`${row.month}-${row.region}`);
                        }}
                    >
                        수정
                    </Button>
                ),
        },
    ];

    return (
        <div>
            <Typography.Title level={4}>📊 월별 지역별 단계별 현황</Typography.Title>

            {isAdmin && (
                <Form
                    form={form}
                    layout="inline"
                    onFinish={handleAddOrUpdate}
                    style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}
                >
                    <Form.Item name="month" rules={[{ required: true }]}>
                        <InputNumber placeholder="월" min={1} max={12} />
                    </Form.Item>
                    <Form.Item name="region" rules={[{ required: true }]}>
                        <Input placeholder="지역" />
                    </Form.Item>
                    <Form.Item name="a">
                        <InputNumber placeholder="A" />
                    </Form.Item>
                    <Form.Item name="b">
                        <InputNumber placeholder="B" />
                    </Form.Item>
                    <Form.Item name="c">
                        <InputNumber placeholder="C" />
                    </Form.Item>
                    <Form.Item name="d_1">
                        <InputNumber placeholder="D-1" />
                    </Form.Item>
                    <Form.Item name="d_2">
                        <InputNumber placeholder="D-2" />
                    </Form.Item>
                    <Form.Item name="f">
                        <InputNumber placeholder="F" />
                    </Form.Item>
                    <Form.Item name="센확">
                        <InputNumber placeholder="센확" />
                    </Form.Item>
                    <Form.Item name="센등">
                        <InputNumber placeholder="센등" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit">
                            {editingKey ? '수정 완료' : '추가'}
                        </Button>
                    </Form.Item>
                </Form>
            )}

            <Table
                rowKey={(row) => `${row.month}-${row.region}-${row.isTotal ? 'total' : 'row'}`}
                dataSource={enhancedData}
                columns={columns}
                pagination={false}
                rowClassName={(row) => (row.isTotal ? 'bg-gray-100 font-semibold' : '')}
                scroll={{ y: 600 }}
                sticky
            />
        </div>
    );
}
