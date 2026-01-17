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

        // 1) payload를 VALUES로 만들기
        const values: any[] = [];
        const placeholders: string[] = [];

        targets.forEach((t, i) => {
            const idx = i * 4;

            // ✅ 여기서 타입 캐스팅 강제!!
            placeholders.push(`($${idx + 1}::int, $${idx + 2}::text, $${idx + 3}::timestamptz, $${idx + 4}::text)`);

            values.push(t.번호, t.month, t.date ? new Date(t.date) : null, t.week);
        });

        const tempCTE = `
      WITH incoming(student_id, next_target, next_trydate, next_week) AS (
        VALUES ${placeholders.join(',')}
      )
    `;

        /**
         * 2) 학생 update 한번에
         */
        await client.query(
            `
      ${tempCTE}
      UPDATE students s
      SET
        target = i.next_target,
        trydate = i.next_trydate,
        numberofweek = i.next_week
      FROM incoming i
      WHERE s.id = i.student_id
        AND (
          s.target IS DISTINCT FROM i.next_target OR
          s.trydate IS DISTINCT FROM i.next_trydate OR
          s.numberofweek IS DISTINCT FROM i.next_week
        )
      `,
            values,
        );

        /**
         * 3) target 변경된 애들만 history insert
         */
        await client.query(
            `
      ${tempCTE},
      changed AS (
        SELECT
          s.id AS student_id,
          s.target AS prev_target,
          i.next_target
        FROM students s
        JOIN incoming i ON i.student_id = s.id
        WHERE i.next_target IS NOT NULL
          AND s.target IS DISTINCT FROM i.next_target
      ),
      max_count AS (
        SELECT
          student_id,
          COALESCE(MAX(change_count), 0) AS max_change
        FROM student_target_history
        WHERE student_id IN (SELECT student_id FROM changed)
        GROUP BY student_id
      ),
      numbered AS (
        SELECT
          c.student_id,
          c.next_target AS target,
          (m.max_change + 1) AS change_count
        FROM changed c
        JOIN max_count m ON m.student_id = c.student_id
      )
      INSERT INTO student_target_history (student_id, target, change_count)
      SELECT student_id, target, change_count
      FROM numbered
      `,
            values,
        );

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
