import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';

export async function POST(req: NextRequest) {
    const client = await pool.connect();

    try {
        const body = await req.json();
        const { 번호, 단계, ...dateFields } = body;

        const allowedFields = [
            'a_완료일',
            'b_완료일',
            'c_완료일',
            'd_1_완료일',
            'd_2_완료일',
            'e_완료일',
            'f_완료일',
            '센확_완료일',
        ];

        const fields = Object.entries(dateFields)
            .filter(([key]) => allowedFields.includes(key))
            .map(([key, value]) => `${key} = ${value ? `'${value}'` : 'NULL'}`);

        // 단계도 포함시키기
        if (단계 !== undefined) {
            fields.push(`단계 = '${단계}'`);
        }

        if (fields.length === 0) {
            return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
        }

        const updateQuery = `
            UPDATE students
            SET ${fields.join(', ')}, updated_at = NOW()
            WHERE id = $1
        `;

        await client.query(updateQuery, [번호]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('날짜 수정 실패:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        client.release();
    }
}
