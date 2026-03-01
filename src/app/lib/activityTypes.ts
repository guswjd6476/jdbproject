export type ActivityRole = '노방' | '온라인' | '만남' | '교사' | '잎사귀';

export const ACTIVITY_ROLES: ActivityRole[] = ['노방', '온라인', '만남', '교사', '잎사귀'];

export type ActivityRow = {
    id: string;
    날짜: string; // '' 또는 'YYYY-MM-DD'
    지역: string;
    팀: string;
    이름: string;
    활동: ActivityRole | '';
    memo: string;
    member_id: string | null; // 동명이인 선택 후 저장용(서버에 member_id로 전달)
};
