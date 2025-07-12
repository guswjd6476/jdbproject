'use client';

import React from 'react';
import { Layout, Menu } from 'antd';
import { UserAddOutlined, UserSwitchOutlined } from '@ant-design/icons';
import Link from 'next/link';

const { Sider } = Layout;

const menuItems = [
    {
        key: 'members',
        icon: <UserAddOutlined />,
        label: <Link href="/admin/members">명단 업데이트</Link>,
    },
    {
        key: 'view',
        icon: <UserSwitchOutlined />,
        label: <Link href="/admin/correction">삭제 및 수정</Link>,
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
