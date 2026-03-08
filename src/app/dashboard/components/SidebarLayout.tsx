'use client';

import React from 'react';
import { Layout, Menu } from 'antd';
import { TeamOutlined, AimOutlined, SyncOutlined, UserSwitchOutlined, SettingOutlined } from '@ant-design/icons';
import Link from 'next/link';

const { Sider } = Layout;

const menuItems = [
    {
        key: 'students',
        icon: <TeamOutlined />,
        label: <Link href="/dashboard/teamcompare">지역별 팀 비교</Link>,
    },
    {
        key: 'goal',
        icon: <AimOutlined />,
        label: <Link href="/dashboard/goal">목표달성</Link>,
    },
    {
        key: 'ban',
        icon: <SyncOutlined />,
        label: <Link href="/dashboard/ban">반전도점검</Link>,
    },
    {
        key: 'activities',
        icon: <SettingOutlined />,
        label: <Link href="/dashboard/activities/view">활동자 관리</Link>,
    },
    {
        key: 'teacher',
        icon: <UserSwitchOutlined />,
        label: <Link href="/dashboard/teacher">교사관리</Link>,
    },
    // {
    //   key: 'settings',
    //   icon: <SettingOutlined />,
    //   label: <Link href="/settings">설정</Link>,
    // },
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
