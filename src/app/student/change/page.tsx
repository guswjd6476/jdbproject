'use client';

import React, { useState } from 'react';
import { Input, List, Typography, Card, Button, Alert, Spin } from 'antd';
import { useUser } from '@/app/hook/useUser'; // 1. useUser 훅 임포트
import Link from 'next/link'; // 1. Link 컴포넌트 임포트

interface MentorInfo {
    번호: number;
    이름: string;
    인도자지역: string;
    인도자팀: string;
    인도자이름: string;
    교사지역: string;
    교사팀: string;
    교사이름: string;
    단계?: string;
    연락처?: string;
    생년월일?: string;
    인도자_고유번호?: string;
    교사_고유번호?: string;
}

export default function MentorChanger() {
    // 2. useUser 훅에서 isAdmin과 isLoading 상태를 가져옵니다.
    const { isAdmin, isLoading: isUserLoading } = useUser();

    const [students, setStudents] = useState<MentorInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<MentorInfo | null>(null);

    const [selectedInductorName, setSelectedInductorName] = useState('');
    const [selectedInductorTeam, setSelectedInductorTeam] = useState('');
    const [selectedInductorRegion, setSelectedInductorRegion] = useState('');

    const [selectedTeacherName, setSelectedTeacherName] = useState('');
    const [selectedTeacherTeam, setSelectedTeacherTeam] = useState('');
    const [selectedTeacherRegion, setSelectedTeacherRegion] = useState('');

    const safeTrim = (value: string | null | undefined): string => (value || '').trim();

    const extractTeamNumber = (team: string): string => {
        const match = safeTrim(team).match(/^[0-9]+/);
        return match ? match[0] : '';
    };

    const fetchStudents = async () => {
        const keyword = safeTrim(searchKeyword);
        if (!keyword) {
            alert('검색어를 입력하세요');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`/api/students?q=${encodeURIComponent(keyword)}`);
            if (!res.ok) throw new Error('데이터 조회 실패');
            const data = await res.json();
            setStudents(data);
            setSelectedStudent(null);
        } catch (e) {
            console.error(e);
            alert('검색 중 오류가 발생했습니다');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectStudent = (student: MentorInfo) => {
        setSelectedStudent(student);
        setSelectedInductorName(student.인도자이름);
        setSelectedInductorTeam(extractTeamNumber(student.인도자팀));
        setSelectedInductorRegion(student.인도자지역);
        setSelectedTeacherName(student.교사이름);
        setSelectedTeacherTeam(extractTeamNumber(student.교사팀));
        setSelectedTeacherRegion(student.교사지역);
    };

    const handleSave = async () => {
        if (!selectedStudent) return;

        const 인도자이름 = safeTrim(selectedInductorName);
        const 인도자팀 = extractTeamNumber(selectedInductorTeam);
        const 인도자지역 = safeTrim(selectedInductorRegion);

        if (!인도자이름 || !인도자팀 || !인도자지역) {
            alert('인도자 정보를 모두 입력해주세요.');
            return;
        }

        const 단계 = (selectedStudent.단계 || '').toUpperCase();
        const 단계상위 = ['합', '섭', '복', '예정'];

        const 교사이름 = safeTrim(selectedTeacherName);
        const 교사팀 = extractTeamNumber(selectedTeacherTeam);
        const 교사지역 = safeTrim(selectedTeacherRegion);

        if (단계상위.includes(단계)) {
            if (!교사이름 || !교사팀 || !교사지역) {
                alert('C단계 이상은 교사 정보도 필요합니다.');
                return;
            }
        }

        const updated = {
            번호: Number(selectedStudent.번호),
            단계: selectedStudent.단계 ?? '',
            인도자이름,
            인도자지역,
            인도자팀,
            교사이름,
            교사지역,
            교사팀,
        };

        try {
            const res = await fetch('/api/students/update-mentors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated),
            });
            const result = await res.json();
            if (!res.ok || !result.success) {
                throw new Error(result.message || '업데이트 실패');
            }
            alert('저장되었습니다');
        } catch (err) {
            console.error('저장 실패:', err);
            alert('저장 중 오류가 발생했습니다');
        }

        setSelectedStudent(null);
        setStudents([]);
        setSearchKeyword('');
        setSelectedInductorName('');
        setSelectedInductorTeam('');
        setSelectedInductorRegion('');
        setSelectedTeacherName('');
        setSelectedTeacherTeam('');
        setSelectedTeacherRegion('');
    };

    // 3. 렌더링 게이트: 사용자 인증 정보를 불러오는 동안 로딩 화면을 표시합니다.
    if (isUserLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <Spin size="large" />
            </div>
        );
    }

    // 4. 렌더링 게이트: 로딩이 끝난 후, 관리자가 아닐 경우 접근 거부 메시지를 표시합니다.
    if (!isAdmin) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <Alert
                    message="접근 권한 없음"
                    description="이 페이지에 접근할 수 있는 권한이 없습니다. 관리자에게 문의하세요."
                    type="error"
                    showIcon
                />
                <Link href="/student/view">
                    <Button type="primary" style={{ marginTop: '20px' }}>
                        수강생 조회 페이지로 돌아가기
                    </Button>
                </Link>
            </div>
        );
    }

    // 5. 위 두 조건을 모두 통과한 경우(로딩이 끝났고, 관리자인 경우)에만 실제 페이지 내용을 렌더링합니다.
    return (
        <div className="p-4 space-y-6 max-w-4xl mx-auto">
            <Card title="수강생 및 멘토 검색">
                <Input
                    placeholder="수강생, 인도자, 교사 이름/지역/팀 입력"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    allowClear
                />
                <Button type="primary" onClick={fetchStudents} style={{ marginTop: 8 }}>
                    검색
                </Button>

                <List
                    loading={loading}
                    bordered
                    size="small"
                    dataSource={students}
                    style={{ marginTop: 12, maxHeight: 300, overflowY: 'auto' }}
                    renderItem={(item) => (
                        <List.Item
                            key={item.번호}
                            onClick={() => handleSelectStudent(item)}
                            style={{
                                cursor: 'pointer',
                                backgroundColor: selectedStudent?.번호 === item.번호 ? '#e6f7ff' : undefined,
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <div style={{ display: 'flex', gap: 12, width: '100%', fontSize: 14 }}>
                                <div style={{ minWidth: 80 }}>
                                    {item.이름} (번호: {item.번호})
                                </div>
                                <div style={{ minWidth: 120 }}>
                                    인도자: {item.인도자이름} ({item.인도자지역} {extractTeamNumber(item.인도자팀)})
                                </div>
                                <div style={{ minWidth: 120 }}>
                                    교사: {item.교사이름} ({item.교사지역} {extractTeamNumber(item.교사팀)})
                                </div>
                            </div>
                        </List.Item>
                    )}
                />
            </Card>

            {selectedStudent && (
                <Card title={`${selectedStudent.이름} - 인도자 / 교사 변경`}>
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 300px' }}>
                            <Typography.Text strong>인도자 이름</Typography.Text>
                            <Input
                                value={selectedInductorName}
                                onChange={(e) => setSelectedInductorName(e.target.value)}
                                placeholder="인도자 이름 입력"
                                style={{ marginBottom: 8 }}
                            />
                            <Typography.Text strong>인도자 지역</Typography.Text>
                            <Input
                                value={selectedInductorRegion}
                                onChange={(e) => setSelectedInductorRegion(e.target.value)}
                                placeholder="인도자 지역 입력"
                                style={{ marginBottom: 8 }}
                            />
                            <Typography.Text strong>인도자 팀</Typography.Text>
                            <Input
                                value={selectedInductorTeam}
                                onChange={(e) => setSelectedInductorTeam(e.target.value)}
                                placeholder="인도자 팀 입력"
                            />
                        </div>

                        <div style={{ flex: '1 1 300px' }}>
                            <Typography.Text strong>교사 이름</Typography.Text>
                            <Input
                                value={selectedTeacherName}
                                onChange={(e) => setSelectedTeacherName(e.target.value)}
                                placeholder="교사 이름 입력"
                                style={{ marginBottom: 8 }}
                            />
                            <Typography.Text strong>교사 지역</Typography.Text>
                            <Input
                                value={selectedTeacherRegion}
                                onChange={(e) => setSelectedTeacherRegion(e.target.value)}
                                placeholder="교사 지역 입력"
                                style={{ marginBottom: 8 }}
                            />
                            <Typography.Text strong>교사 팀</Typography.Text>
                            <Input
                                value={selectedTeacherTeam}
                                onChange={(e) => setSelectedTeacherTeam(e.target.value)}
                                placeholder="교사 팀 입력"
                            />
                        </div>
                    </div>

                    <div style={{ textAlign: 'right', marginTop: 16 }}>
                        <Button type="primary" onClick={handleSave}>
                            저장
                        </Button>
                    </div>
                </Card>
            )}
        </div>
    );
}
