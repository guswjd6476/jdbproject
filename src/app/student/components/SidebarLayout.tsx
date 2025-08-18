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
    // ✨ 3. useUser 훅을 호출하여 사용자 정보를 가져옵니다.
    const { isAdmin, isLoading } = useUser();

    // ✨ 4. useMemo를 사용하여 isAdmin 상태가 변경될 때만 메뉴 항목을 다시 계산합니다.
    //    이렇게 하면 불필요한 리렌더링을 방지할 수 있습니다.
    const visibleMenuItems = useMemo(() => {
        // isAdmin이 true이면 모든 메뉴를 반환합니다.
        // isAdmin이 false이면 adminOnly가 아닌 메뉴만 필터링하여 반환합니다.
        return allMenuItems.filter((item) => !item.adminOnly || isAdmin);
    }, [isAdmin]);

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

                {/* ✨ 5. 사용자 정보를 불러오는 동안 로딩 스피너를 표시합니다. */}
                {isLoading ? (
                    <div style={{ textAlign: 'center', marginTop: 20 }}>
                        <Spin />
                    </div>
                ) : (
                    <Menu
                        theme="dark"
                        mode="inline"
                        defaultSelectedKeys={['dashboard']}
                        // ✨ 6. 동적으로 필터링된 메뉴 항목을 사용합니다.
                        items={visibleMenuItems}
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
