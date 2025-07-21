'use client';

import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface TeacherRow {
    이름: string;
    고유번호: string;
    구역: string;
    지역: string;
    등록구분: string;
    활동여부: string;
    현재진행: number;
}

export default function TeacherTable({ data }: { data: TeacherRow[] }) {
    const columns: ColumnsType<TeacherRow> = [
        { title: '이름', dataIndex: '이름', key: '이름' },
        { title: '고유번호', dataIndex: '고유번호', key: '고유번호' },
        { title: '지역', dataIndex: '지역', key: '지역' },
        { title: '구역', dataIndex: '구역', key: '구역' },
        { title: '등록구분', dataIndex: '등록구분', key: '등록구분' },
        { title: '활동여부', dataIndex: '활동여부', key: '활동여부' },
        { title: '현재진행', dataIndex: '현재진행', key: '현재진행' },
    ];

    return (
        <Table
            dataSource={data}
            columns={columns}
            rowKey="고유번호"
            pagination={false}
        />
    );
}
