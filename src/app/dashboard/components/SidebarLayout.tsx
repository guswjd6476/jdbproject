'use client';

import React from 'react';
import { Layout, Menu } from 'antd';
import { TeamOutlined, SettingOutlined } from '@ant-design/icons';
import Link from 'next/link';

const { Header, Sider, Content } = Layout;

const menuItems = [
    {
        key: 'students',
        icon: <TeamOutlined />,
        label: <Link href="/dashboard/teamcompare">지역별 팀 비교</Link>,
    },
    {
        key: 'settings',
        icon: <SettingOutlined />,
        label: <Link href="/settings">설정</Link>,
    },
];

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider breakpoint="lg" collapsedWidth="0">
                <div style={{ height: 32, margin: 16, color: 'white', fontWeight: 'bold' }}>🎯 대시보드</div>
                <Menu theme="dark" mode="inline" defaultSelectedKeys={['dashboard']} items={menuItems} />
            </Sider>

            <Layout>
                <Header style={{ background: '#fff', padding: 0 }} />
                <Content style={{ margin: '24px 16px', padding: 24, background: '#fff' }}>
                    <main className="max-w-6xl mx-auto">{children}</main>
                </Content>
            </Layout>
        </Layout>
    );
}
