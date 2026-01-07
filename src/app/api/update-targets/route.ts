import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';

type TargetItem = {
    번호: number;
    month: string | null;
    date: string | null;
    week: string | null;
};

export async function POST(req: NextRequest) {
    const client = await pool.connect();

    try {
        const { targets } = (await req.json()) as { targets: TargetItem[] };

        if (!targets || targets.length === 0) {
            return NextResponse.json({ success: true });
        }

        await client.query('BEGIN');

        for (const t of targets) {
            const studentId = t.번호;

            /* =========================
               1️⃣ 기존 target 조회
            ========================= */
            const prevRes = await client.query(`SELECT target FROM students WHERE id = $1 FOR UPDATE`, [studentId]);

            if (prevRes.rowCount === 0) continue;

            const prevTarget: string | null = prevRes.rows[0].target;
            const nextTarget: string | null = t.month;

            /* =========================
               2️⃣ target 변경된 경우만 history 기록
            ========================= */
            if (nextTarget && nextTarget !== prevTarget) {
                // 현재 최대 change_count 조회
                const countRes = await client.query(
                    `
                    SELECT COALESCE(MAX(change_count), 0) AS max
                    FROM student_target_history
                    WHERE student_id = $1
                    `,
                    [studentId]
                );

                const nextCount = Number(countRes.rows[0].max) + 1;

                await client.query(
                    `
                    INSERT INTO student_target_history
                      (student_id, target, change_count)
                    VALUES
                      ($1, $2, $3)
                    `,
                    [studentId, nextTarget, nextCount]
                );
            }

            /* =========================
               3️⃣ students 테이블 업데이트
            ========================= */
            await client.query(
                `
                UPDATE students
                SET
                    target = $2,
                    trydate = $3,
                    numberofweek = $4
                WHERE id = $1
                `,
                [studentId, nextTarget, t.date ? new Date(t.date) : null, t.week]
            );
        }

        await client.query('COMMIT');
        return NextResponse.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('update-targets error:', err);
        return NextResponse.json({ error: '타겟 저장 중 오류 발생' }, { status: 500 });
    } finally {
        client.release();
    }
}
