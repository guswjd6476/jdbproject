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

        const res = await client.query(
            `
            SELECT 
                student_id,
                target,
                change_count,
                created_at
            FROM student_target_history
            WHERE student_id = $1
            ORDER BY change_count DESC
            `,
            [id],
        );

        return NextResponse.json({
            success: true,
            history: res.rows,
        });
    } catch (err) {
        console.error('GET /api/students/target-history error:', err);
        return NextResponse.json({ success: false, message: '서버 오류' }, { status: 500 });
    } finally {
        client.release();
    }
}
