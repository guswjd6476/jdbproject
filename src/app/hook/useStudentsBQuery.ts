import { useQuery } from '@tanstack/react-query';

export type Students = {
    번호: number;
    이름: string;
    단계: string;
    인도자지역?: string;
    인도자팀?: string;
    인도자이름?: string;
    교사지역?: string;
    교사팀?: string;
    교사이름?: string;
    target?: string;
    trydate?: string;
    numberofweek?: string;
};

async function fetchStudentsB(): Promise<Students[]> {
    const res = await fetch('/api/students-b');
    if (!res.ok) {
        throw new Error('학생 데이터를 불러오는데 실패했습니다.');
    }
    return res.json();
}

export function useStudentsBQuery() {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['students-b'],
        queryFn: fetchStudentsB,
    });

    return {
        data: data ?? [],
        isLoading,
        isError,
    };
}
