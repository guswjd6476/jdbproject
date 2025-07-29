import { useQuery } from '@tanstack/react-query';
export interface Students {
    id: number;
    이름: string;
    단계: string | null;
    인도자지역: string | null;
    인도자팀: string | null;
    교사지역: string | null;
    교사팀: string | null;
    target: string | null;
    발?: string | null;
    찾?: string | null;
    합?: string | null;
    섭?: string | null;
    복?: string | null;
    예정?: string | null;
    g?: string | null; // 탈락일 추가
    [key: string]: string | number | null | undefined;
}

export const useStudentsQuery = () => {
    return useQuery<Students[]>({
        queryKey: ['students'],
        queryFn: async () => {
            const res = await fetch('/api/students');
            if (!res.ok) throw new Error('데이터를 불러오는 데 실패했습니다.');
            const data: Students[] = await res.json();

            return data.filter((s) => s.번호 != null);
        },
        staleTime: 1000 * 60 * 60 * 24,
    });
};
