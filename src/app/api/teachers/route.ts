// app/api/teachers/route.ts
import { verifyToken } from '@/app/lib/auth';
import { getMemberTableQueryCondition } from '@/app/lib/authUtils';
import { JwtPayload } from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getTeachersDataDirectly } from '@/app/lib/teachersService'; // 신규 서비스 임포트

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

interface Teacher {
    고유번호: string;
    등록구분: string;
}

// POST: 기존 로직 그대로 유지
export async function POST(request: NextRequest) {
    try {
        const teachers: Teacher[] = await request.json();
        if (!Array.isArray(teachers)) {
            return NextResponse.json({ error: '배열 형태로 요청해주세요.' }, { status: 400 });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const t of teachers) {
                await client.query(
                    `INSERT INTO teachers (uid, type, updated_at)
                     VALUES ($1, $2, NOW())
                     ON CONFLICT (uid) DO UPDATE SET type = EXCLUDED.type, updated_at = NOW()`,
                    [t.고유번호, t.등록구분],
                );
            }
            await client.query('COMMIT');

            const result = await client.query(
                `SELECT m.고유번호, m.이름, m.지역, m.구역, t.type AS 교사형태,
                        to_char(t.updated_at, 'YYYY-MM-DD HH24:MI:SS') AS "마지막업데이트"
                 FROM teachers t JOIN members m ON m.고유번호 = t.uid WHERE t.uid = ANY($1) ORDER BY t.uid`,
                [teachers.map((t) => t.고유번호)],
            );
            client.release();
            return NextResponse.json(result.rows);
        } catch (e) {
            await client.query('ROLLBACK');
            client.release();
            console.error(e);
            return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
        }
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }
}

// GET: 깔끔하게 정리된 데이터 스트림 리포트
export async function GET(request: NextRequest) {
    try {
        // 1. 전체 데이터를 서비스 함수로부터 즉시 덤프받음
        const allRows = await getTeachersDataDirectly();

        // 2. 기존 쿼리 파라미터 필터링(검색어) 로직을 JS 레벨에서 가볍게 처리
        const search = request.nextUrl.searchParams.get('q')?.trim().toLowerCase();
        let filteredRows = allRows;

        if (search) {
            filteredRows = allRows.filter(
                (row) =>
                    row.이름.toLowerCase().includes(search) ||
                    row.지역.toLowerCase().includes(search) ||
                    (row.구역 && row.구역.toLowerCase().includes(search)),
            );
        }

        // 3. 토큰 권한 검증 컨텍스트가 필요한 경우 필터 추가 가능 (기본 전체 반환)
        return NextResponse.json(filteredRows);
    } catch (err: unknown) {
        console.error('GET /api/teachers 에러:', err);
        const message = err instanceof Error ? err.message : '데이터 조회 실패';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
