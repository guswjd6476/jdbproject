import { pool } from '@/app/lib/db';
import { REGIONS } from '@/app/lib/types';
import { NextResponse } from 'next/server';

interface Member {
    순번: number;
    이름: string;
    고유번호: string;
    등록구분: string;
    등록상태: string;
    등록사유: string;
    지역: string;
    구역: string;
}
export async function GET() {
    const client = await pool.connect();
    try {
        const query = `
            SELECT
                지역,
                split_part(구역, '-', 1) AS 팀,
                COUNT(*) AS 재적
            FROM members
            WHERE 지역 = ANY($1)
            GROUP BY 지역, 팀
        `;
        const values = [REGIONS];

        const { rows } = await client.query(query, values);

        return NextResponse.json(rows);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    } finally {
        client.release();
    }
}
export async function POST(request: Request) {
    const members: Member[] = await request.json();

    if (!Array.isArray(members) || members.length === 0) {
        return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const values: (number | string)[] = [];
        const valuePlaceholders: string[] = [];

        members.forEach((member, i) => {
            const idx = i * 8;
            values.push(
                member.순번,
                member.이름,
                member.고유번호,
                member.등록구분,
                member.등록상태,
                member.등록사유,
                member.지역,
                member.구역
            );

            const placeholders = Array.from({ length: 8 }, (_, j) => `$${idx + j + 1}`);
            valuePlaceholders.push(`(${placeholders.join(', ')}, NOW())`);
        });

        const query = `
            INSERT INTO members 
                (순번, 이름, 고유번호, 등록구분, 등록상태, 등록사유, 지역, 구역, updated_at)
            VALUES 
                ${valuePlaceholders.join(', ')}
            ON CONFLICT (고유번호) DO UPDATE SET
                순번 = EXCLUDED.순번,
                이름 = EXCLUDED.이름,
                등록구분 = EXCLUDED.등록구분,
                등록상태 = EXCLUDED.등록상태,
                등록사유 = EXCLUDED.등록사유,
                지역 = EXCLUDED.지역,
                구역 = EXCLUDED.구역,
                updated_at = NOW()
        `;

        await client.query(query, values);
        await client.query('COMMIT');

        return NextResponse.json({
            message: '성공',
            count: members.length,
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    } finally {
        client.release();
    }
}
