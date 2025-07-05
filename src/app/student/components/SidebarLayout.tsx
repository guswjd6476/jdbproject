'use client';

import React from 'react';
import { Layout, Menu } from 'antd';
import { TeamOutlined, SettingOutlined } from '@ant-design/icons';
import Link from 'next/link';

const { Sider } = Layout;

const menuItems = [
    {
        key: 'add',
        icon: <TeamOutlined />,
        label: <Link href="/student/add">수강생 등록</Link>,
    },
    {
        key: 'view',
        icon: <TeamOutlined />,
        label: <Link href="/student/view">수강생 조회</Link>,
    },
    {
        key: 'todayadd',
        icon: <TeamOutlined />,
        label: <Link href="/student/todayadd">금일등록</Link>,
    },
    {
        key: 'develop',
        icon: <TeamOutlined />,
        label: <Link href="/student/develop">B이상관리</Link>,
    },
    {
        key: 'change',
        icon: <SettingOutlined />,
        label: <Link href="/student/change">행정 변경</Link>,
    },
];

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider
                breakpoint="lg"
                collapsedWidth="0"
            >
                <div style={{ height: 32, margin: 16, color: 'white', fontWeight: 'bold' }}>🎯 대시보드</div>
                <Menu
                    theme="dark"
                    mode="inline"
                    defaultSelectedKeys={['dashboard']}
                    items={menuItems}
                />
            </Sider>

            <Layout>
                <main className="mx-auto w-full">{children}</main>
            </Layout>
        </Layout>
    );
}
