import { pool } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const client = await pool.connect();

    try {
        const studentId = req.nextUrl.searchParams.get('studentId');

        if (!studentId) {
            return NextResponse.json({ success: false, message: 'studentId 누락' }, { status: 400 });
        }

        const id = Number(studentId);
        if (Number.isNaN(id)) {
            return NextResponse.json({ success: false, message: 'studentId 형식 오류' }, { status: 400 });
        }

        // ✅ 정렬 순서를 change_count DESC로 가져오되, 생성 시간(created_at)도 2차 기준으로 정렬하여 안전성을 높입니다.
        const res = await client.query(
            `
            SELECT 
                student_id AS "studentId",
                target,
                change_count AS "changeCount",
                created_at AS "createdAt"
            FROM student_target_history
            WHERE student_id = $1
            ORDER BY change_count DESC, created_at DESC
            `,
            [id],
        );

        return NextResponse.json({
            success: true,
            history: res.rows,
        });
    } catch (err) {
        console.error('GET /api/students/target-history error:', err);
        const message = err instanceof Error ? err.message : '서버 오류';
        return NextResponse.json({ success: false, message }, { status: 500 });
    } finally {
        client.release();
    }
}
