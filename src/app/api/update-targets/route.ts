import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';

type TargetItem = {
    번호: number;
    month: string | null;
    date: string | null; // 'YYYY-MM-DD' 형식 문자열
    week: string | null;
};

export async function POST(req: NextRequest) {
    const client = await pool.connect();

    try {
        const { targets } = (await req.json()) as { targets: TargetItem[] };

        if (targets.length === 0) {
            client.release();
            return NextResponse.json({ success: true });
        }

        const values: string[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const params: any[] = [];

        targets.forEach(({ 번호, month, date, week }, idx) => {
            const base = idx * 4;
            values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
            params.push(번호.toString(), month, date, week);
        });

        const query = `
      UPDATE students AS s
      SET 
        target = v.month,
        trydate = v.date::timestamp,
        numberofweek = v.week
      FROM (
        VALUES
        ${values.join(',')}
      ) AS v(id, month, date, week)
      WHERE s.id = v.id::integer
    `;

        await client.query(query, params);
        client.release();

        return NextResponse.json({ success: true });
    } catch (err) {
        client.release();
        console.error('DB 업데이트 오류:', err);
        return NextResponse.json({ error: '서버 오류 발생' }, { status: 500 });
    }
}
