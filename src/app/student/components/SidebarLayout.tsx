// SidebarLayout.tsx
'use client';

import React, { useMemo } from 'react';
import { Layout, Menu, Spin } from 'antd';
import {
    SettingOutlined,
    UserAddOutlined,
    UserSwitchOutlined,
    FileAddOutlined,
    AppstoreOutlined,
    CalendarOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useUser } from '@/app/hook/useUser'; // ✨ 1. useUser 훅을 임포트합니다.

const { Sider } = Layout;

// ✨ 2. 모든 메뉴 항목의 '마스터 리스트'를 정의합니다.
//    관리자 전용 메뉴에는 'adminOnly: true' 속성을 추가합니다.
const allMenuItems = [
    {
        key: 'add',
        icon: <UserAddOutlined />,
        label: <Link href="/student/add">수강생 등록</Link>,
        adminOnly: true, // 관리자 전용
    },
    {
        key: 'activities',
        icon: <UserAddOutlined />,
        label: <Link href="/dashboard/activities">활동자등록</Link>,
        adminOnly: true, // 관리자 전용
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
        adminOnly: true, // 관리자 전용
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
        adminOnly: true, // 관리자 전용
    },
];

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
    const { isAdmin, isLoading } = useUser();

    const visibleMenuItems = useMemo(() => {
        return allMenuItems
            .filter((item) => !item.adminOnly || isAdmin) // 1. 권한에 따른 필터링
            .map(({ adminOnly, ...rest }) => rest); // 2. ✨ adminOnly 속성을 제거하고 나머지만 반환
    }, [isAdmin]);

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
                    🎯 학생관리
                </div>

                {isLoading ? (
                    <div style={{ textAlign: 'center', marginTop: 20 }}>
                        <Spin />
                    </div>
                ) : (
                    <Menu
                        theme="dark"
                        mode="inline"
                        defaultSelectedKeys={['dashboard']}
                        items={visibleMenuItems} // 이제 adminOnly가 없는 깨끗한 객체가 전달됩니다.
                        style={{ fontSize: 16 }}
                    />
                )}
            </Sider>

            <Layout>
                <main className="mx-auto w-full">{children}</main>
            </Layout>
        </Layout>
    );
}
