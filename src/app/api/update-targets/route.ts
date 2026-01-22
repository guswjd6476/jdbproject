import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';

type TargetItem = {
    번호: number;
    month: string | null;
    date: string | null;
    week: string | null;
};

// ✅ 공백 / null 안전 처리
const normalizeText = (v: any): string | null => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s.length === 0 ? null : s;
};

export async function POST(req: NextRequest) {
    const client = await pool.connect();

    try {
        const { targets } = (await req.json()) as { targets: TargetItem[] };

        if (!targets || targets.length === 0) {
            return NextResponse.json({ success: true });
        }

        await client.query('BEGIN');

        const values: any[] = [];
        const placeholders: string[] = [];

        targets.forEach((t, i) => {
            const idx = i * 4;

            // ✅ 타입 강제 캐스팅 (integer=text 에러 방지)
            placeholders.push(`($${idx + 1}::int, $${idx + 2}::text, $${idx + 3}::timestamptz, $${idx + 4}::text)`);

            values.push(
                Number(t.번호),
                normalizeText(t.month), // ✅ trim 적용
                t.date ? new Date(t.date) : null,
                normalizeText(t.week), // week도 공백 들어오면 정리
            );
        });

        const tempCTE = `
      WITH incoming(student_id, next_target, next_trydate, next_week) AS (
        VALUES ${placeholders.join(',')}
      )
    `;

        /**
         * ✅ 1) 바뀐 row만 students 업데이트
         * - update 전에 trim 된 next_target로 들어감
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
         * ✅ 2) 히스토리 insert 조건 강화
         *
         * ✅ 요구사항 충족:
         * - prevTarget(현재 students.target) == nextTarget 이면 history 쌓이면 안됨
         * - 1월 -> 2월 -> 1월 (현재 2월이고 next 1월이면) 쌓여야 함
         *
         * ✅ 따라서 조건은:
         *   next_target IS NOT NULL
         *   AND trim(prev_target) != trim(next_target)
         */
        await client.query(
            `
      ${tempCTE},
      changed AS (
        SELECT
          s.id AS student_id,
          NULLIF(TRIM(s.target), '') AS prev_target_norm,
          NULLIF(TRIM(i.next_target), '') AS next_target_norm
        FROM students s
        JOIN incoming i ON i.student_id = s.id
        WHERE NULLIF(TRIM(i.next_target), '') IS NOT NULL
          AND NULLIF(TRIM(s.target), '') IS DISTINCT FROM NULLIF(TRIM(i.next_target), '')
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
          c.next_target_norm AS target,
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
