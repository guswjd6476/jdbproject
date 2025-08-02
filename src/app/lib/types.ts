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
    '번호',
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
export const STEPS = ['발', '찾', '합', '섭', '복', '예정', '탈락'] as const;
export const STEPS2 = ['발', '찾', '합', '섭', '복', '예정'] as const;
export type STEP = '발' | '찾' | '합' | '섭' | '복' | '예정' | '탈락';
export type STEP2 = '발' | '찾' | '합' | '섭' | '복' | '예정';
export const REGIONS = ['도봉', '성북', '노원', '중랑', '강북', '대학', '새신자'];
export const fixedTeams = ['1', '2', '3', '4', '5'] satisfies readonly string[];
export interface WeeklyGoals {
    발: number;
    찾: number;
    합: number;
    섭: number;
    복: number;
    예정: number;
}
export type WeeklyPercentages = Record<string, WeeklyGoals>;

export interface ConversionRates {
    발To찾: number;
    찾To합: number;
    합To섭: number;
    섭To복: number;
    복To예정: number;
}

export type 예정Goals = Record<string, string>;

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
    발?: string | null;
    찾?: string | null;
    합?: string | null;
    섭?: string | null;
    복?: string | null;
    예정?: string | null;
    g?: string | null; // 탈락일
    [key: string]: string | number | null | undefined;
}
export type Region = (typeof REGIONS)[number];

export const DEFAULT_예정_goals: Record<Region, 예정Goals> = {
    도봉: { team1: '2.5', team2: '2.0', team3: '1.5', team4: '1', team5: '1' },
    성북: { team1: '2', team2: '2', team3: '2', team4: '2' },
    노원: { team1: '2', team2: '2', team3: '2', team4: '2' },
    중랑: { team1: '2', team2: '2', team3: '2', team4: '2' },
    강북: { team1: '2', team2: '2', team3: '2', team4: '2' },
    대학: { team1: '5', team2: '5', team3: '5', team4: '5' },
    새신자: { team1: '0.5', team2: '0.5' },
};

export interface TableRow {
    key: string;
    지역: string;
    팀: string;
    탈락: number;
    [key: string]: string | number | undefined;
}
export interface TableRow3 {
    key: string;
    월: string;
    지역: string;
    팀: string;
    재적: number;
    예정_goal: number;
    last_month_result: number;
    탈락?: number;
    gospel_score: number;
    gospel_rate: number;
    [key: string]: string | number | undefined;
}
export interface TableRow2 {
    key: string;
    지역: string;
    팀: string;
    [key: string]: string | number | undefined;
}
