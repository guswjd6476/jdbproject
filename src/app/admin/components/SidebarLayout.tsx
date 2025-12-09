'use client';

import React from 'react';
import { Layout, Menu } from 'antd';
import { EditOutlined, TeamOutlined, UploadOutlined, UserAddOutlined, WarningOutlined } from '@ant-design/icons';
import Link from 'next/link';

const { Sider } = Layout;

const menuItems = [
    {
        key: 'teacherUpload',
        icon: <UploadOutlined />,
        label: <Link href="/admin/teacherUpload">교사 업로드</Link>,
    },
    {
        key: 'teacherAdmin',
        icon: <TeamOutlined />,
        label: <Link href="/admin/teacherAdmin">교사 현황</Link>,
    },
    {
        key: 'members',
        icon: <UserAddOutlined />,
        label: <Link href="/admin/members">명단 등록</Link>,
    },
    {
        key: 'view',
        icon: <EditOutlined />,
        label: <Link href="/admin/correction">삭제 및 수정</Link>,
    },
    {
        key: 'error',
        icon: <WarningOutlined />,
        label: <Link href="/admin/error">중복 처리</Link>,
    },
    {
        key: '월',
        icon: <WarningOutlined />,
        label: <Link href="/admin/month">월 단향</Link>,
    },
];

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider
                breakpoint="lg"
                collapsedWidth="0"
            >
                <div
                    style={{
                        height: 48,
                        margin: 16,
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: 20,
                        textAlign: 'center',
                        userSelect: 'none',
                    }}
                >
                    🎯 관리자
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    defaultSelectedKeys={['dashboard']}
                    items={menuItems}
                    style={{ fontSize: 16 }}
                />
            </Sider>

            <Layout>
                <main className="mx-auto w-full">{children}</main>
            </Layout>
        </Layout>
    );
}
