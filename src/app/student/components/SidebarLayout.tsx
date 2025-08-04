'use client';

import React from 'react';
import { Layout, Menu } from 'antd';
import {
    SettingOutlined,
    UserAddOutlined,
    UserSwitchOutlined,
    FileAddOutlined,
    AppstoreOutlined,
    CalendarOutlined,
} from '@ant-design/icons';
import Link from 'next/link';

const { Sider } = Layout;

const menuItems = [
    {
        key: 'add',
        icon: <UserAddOutlined />,
        label: <Link href="/student/add">수강생 등록</Link>,
    },
    {
        key: 'view',
        icon: <UserSwitchOutlined />,
        label: <Link href="/student/view">수강생 조회</Link>,
    },
    {
        key: 'todayadd',
        icon: <FileAddOutlined />,
        label: <Link href="/student/todayadd">금일 등록</Link>,
    },
    {
        key: 'develop',
        icon: <AppstoreOutlined />,
        label: <Link href="/student/develop">합등 이상 관리</Link>,
    },
    {
        key: 'target',
        icon: <CalendarOutlined />,
        label: <Link href="/student/target">개강별 관리</Link>,
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
            <Sider breakpoint="lg" collapsedWidth="0">
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
                    🎯 학생관리
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
