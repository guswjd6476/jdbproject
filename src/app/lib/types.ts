export interface Student {
    단계: string;
    이름: string;
    연락처: string; // 연락처뒷자리 or 온라인아이디
    생년월일: string;
    인도자지역: string;
    인도자팀: string;
    인도자이름: string;
    교사지역: string;
    교사님: string;
    교사이름: string;
}

export const headers = [
    '단계',
    '이름',
    '연락처 뒷자리',
    '생년월일',
    '인도자 지역',
    '인도자 팀',
    '인도자 이름',
    '교사 지역',
    '교사님',
    '교사 이름',
];
