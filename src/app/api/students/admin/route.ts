// app/api/students/admin/route.ts
import { pool } from '@/app/lib/db';

export async function GET() {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM students ORDER BY "id" ASC');
        client.release();

        const rows = result.rows;
        if (!Array.isArray(rows)) {
            return new Response(JSON.stringify({ message: '데이터가 배열이 아님' }), { status: 500 });
        }

        return new Response(JSON.stringify(rows), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('학생 조회 실패:', err);
        return new Response(JSON.stringify({ message: '서버 오류' }), { status: 500 });
    }
}
