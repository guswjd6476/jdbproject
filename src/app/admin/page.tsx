'use client';

import { useUser } from '@/app/hook/useUser';
import { useEffect, useState } from 'react';
import { Spin, Alert, Table } from 'antd';

interface AdminData {
    id: number;
    name: string;
    email: string;
}

export default function AdminPage() {
    const { isAdmin, isLoading } = useUser();
    const [data, setData] = useState<AdminData[]>([]);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        if (!isAdmin) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await fetch('/api/admin/users');
                const result = await res.json();
                setData(result);
            } catch (err) {
                console.error('관리자 데이터 불러오기 실패:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [isAdmin]);

    if (isLoading) return <Spin tip="사용자 정보 확인 중..." className="mt-10 block mx-auto" />;

    if (!isAdmin) {
        return (
            <div className="max-w-xl mx-auto mt-20 text-center">
                <Alert message="접근 권한이 없습니다." type="error" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto mt-10 px-4">
            <h1 className="text-2xl font-bold mb-6">관리자 페이지</h1>

            {loading ? (
                <Spin tip="데이터 불러오는 중..." />
            ) : (
                <Table
                    dataSource={data}
                    rowKey="id"
                    columns={[
                        { title: 'ID', dataIndex: 'id', key: 'id' },
                        { title: '이름', dataIndex: 'name', key: 'name' },
                        { title: '이메일', dataIndex: 'email', key: 'email' },
                    ]}
                />
            )}
        </div>
    );
}
