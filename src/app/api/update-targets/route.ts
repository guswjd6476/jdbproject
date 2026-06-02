import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';

type TargetItem = {
    번호: number;
    month: string | null;
    date: string | null;
    week: string | null;
};

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
            placeholders.push(`($${idx + 1}::int, $${idx + 2}::text, $${idx + 3}::timestamptz, $${idx + 4}::text)`);
            values.push(
                Number(t.번호),
                normalizeText(t.month),
                t.date ? new Date(t.date) : null,
                normalizeText(t.week),
            );
        });

        const tempCTE = `
          WITH incoming(student_id, next_target, next_trydate, next_week) AS (
            VALUES ${placeholders.join(',')}
          )
        `;

        /**
         * ✅ 1) 히스토리 insert를 먼저 수행 (순서 변경 🔥)
         * - students 테이블의 target 값이 업데이트되기 전이므로 기존 목표월(s.target)과의 비교가 정확하게 작동합니다.
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
            history_stats AS (
              SELECT
                student_id,
                COUNT(*) AS cnt,
                COALESCE(MAX(change_count), 0) AS max_change
              FROM student_target_history
              WHERE student_id IN (SELECT student_id FROM changed)
              GROUP BY student_id
            ),
            numbered AS (
              SELECT
                c.student_id,
                c.next_target_norm AS target,
                CASE 
                  WHEN COALESCE(h.cnt, 0) = 0 THEN 0
                  ELSE h.max_change + 1
                END AS change_count
              FROM changed c
              LEFT JOIN history_stats h ON h.student_id = c.student_id
            )
            INSERT INTO student_target_history (student_id, target, change_count)
            SELECT student_id, target, change_count
            FROM numbered
            `,
            values,
        );

        /**
         * ✅ 2) 히스토리를 다 쌓은 후 students 테이블 업데이트 진행
         * - s.prevtarget 컬럼에도 기존의 s.target 값을 백업해 주도록 동기화 로직을 추가했습니다.
         */
        await client.query(
            `
            ${tempCTE}
            UPDATE students s
            SET
              prevtarget = CASE WHEN s.target IS DISTINCT FROM i.next_target THEN s.target ELSE s.prevtarget END,
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
