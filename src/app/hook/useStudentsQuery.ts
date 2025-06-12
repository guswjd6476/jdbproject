import { useQuery } from '@tanstack/react-query';

export interface Student {
    번호: number;
    이름: string;
    연락처: string;
    생년월일?: string;
    단계?: string;
    인도자지역?: string;
    인도자팀?: string;
    인도자이름?: string;
    교사지역?: string;
    교사팀?: string;
    교사이름?: string;
    a?: string;
    b?: string;
    c?: string;
    'd-1'?: string;
    'd-2'?: string;
    e?: string;
    f?: string;
    dropOut?: boolean;
}

export const useStudentsQuery = () => {
    return useQuery<Student[]>({
        queryKey: ['students'],
        queryFn: async () => {
            const res = await fetch('/api/students');
            if (!res.ok) throw new Error('데이터를 불러오는 데 실패했습니다.');
            const data: Student[] = await res.json();
            return data.filter((s) => s.번호 != null);
        },
        staleTime: 1000 * 60 * 60 * 24,
    });
};
