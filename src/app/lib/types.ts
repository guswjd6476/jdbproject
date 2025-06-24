export interface Student {
    id: string;
    단계: string;
    이름: string;
    연락처: string;
    생년월일: string;
    인도자지역: string;
    인도자팀: string;
    인도자이름: string;
    인도자_고유번호: string | null; // 여기 수정
    교사지역: string;
    교사팀: string;
    교사이름: string;
    교사_고유번호: string | null; // 여기 수정
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
    '교사 팀',
    '교사 이름',
];
export const STEPS = ['A', 'B', 'C', 'D-1', 'D-2', 'E', 'F'] as const;
// constants.ts (또는 위쪽에 선언)
export const REGIONS = ['도봉', '성북', '노원', '중랑', '강북', '대학', '새신자'];
export const fixedTeams = ['1', '2', '3', '4', '5'] satisfies readonly string[];
export interface WeeklyGoals {
    A: number;
    B: number;
    C: number;
    D: number;
    F: number;
}

export interface WeeklyPercentages {
    week1: WeeklyGoals;
    week2: WeeklyGoals;
    week3: WeeklyGoals;
    week4: WeeklyGoals;
}

export interface ConversionRates {
    aToB: number;
    bToC: number;
    cToD: number;
    dToF: number;
}

export type FGoals = Record<string, string>;

export interface TeamResult {
    team: number;
    goals: WeeklyGoals;
    weeks: WeeklyGoals[];
}

export interface Results {
    teams: TeamResult[];
    totals: WeeklyGoals;
}
export interface RawStudent {
    번호: number;
    이름: string;
    단계: string | null;
    인도자지역: string | null;
    a?: string | null;
    b?: string | null;
    c?: string | null;
    'd-1'?: string | null;
    'd-2'?: string | null;
    e?: string | null;
    f?: string | null;
    g?: string | null; // 탈락일
    [key: string]: string | number | null | undefined;
}
