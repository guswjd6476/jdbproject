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

const startsWithDigit = (s: string) => /^\d/.test((s ?? '').trim());

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
    const body = await request.json();
    const membersRaw: Member[] = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];

    if (!Array.isArray(membersRaw) || membersRaw.length === 0) {
        return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
    }

    // ✅ 고유번호가 "숫자로 시작"하는 것만 업서트 대상
    const members = membersRaw
        .map((m) => ({
            ...m,
            고유번호: (m.고유번호 ?? '').trim(),
            이름: (m.이름 ?? '').trim(),
            등록구분: (m.등록구분 ?? '').trim(),
            등록상태: (m.등록상태 ?? '').trim(),
            등록사유: (m.등록사유 ?? '').trim(),
            지역: (m.지역 ?? '').trim(),
            구역: (m.구역 ?? '').trim(),
        }))
        .filter((m) => m.고유번호 && startsWithDigit(m.고유번호));

    const skipped = membersRaw.length - members.length;

    // 숫자 고유번호가 하나도 없으면 그냥 성공 처리(문자/UUID는 그대로 둠)
    if (members.length === 0) {
        return NextResponse.json({
            message: '성공(업서트 대상 없음)',
            updated: [],
            upsertedCount: 0,
            skippedNonNumeric: skipped,
        });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1) 기존 고유번호들 일괄 조회 (✅ SQL 인젝션 제거: ANY($1))
        const ids = members.map((m) => m.고유번호);
        const { rows: existingMembers } = await client.query(
            `SELECT 순번, 이름, 고유번호, 등록구분, 등록상태, 등록사유, 지역, 구역
       FROM members
       WHERE 고유번호 = ANY($1)`,
            [ids]
        );

        // 빠른 비교용 map
        const existingMap = new Map<string, any>();
        for (const r of existingMembers) existingMap.set(r.고유번호, r);

        const updatedMembers: Member[] = [];
        const newMembers: Member[] = [];

        for (const member of members) {
            const 기존 = existingMap.get(member.고유번호);
            if (!기존) {
                newMembers.push(member);
            } else {
                const hasChanged =
                    Number(기존.순번) !== Number(member.순번) ||
                    기존.이름 !== member.이름 ||
                    기존.등록구분 !== member.등록구분 ||
                    기존.등록상태 !== member.등록상태 ||
                    기존.등록사유 !== member.등록사유 ||
                    기존.지역 !== member.지역 ||
                    기존.구역 !== member.구역;

                if (hasChanged) updatedMembers.push(member);
            }
        }

        // 2) INSERT + ON CONFLICT UPDATE
        //    (네 방식 유지: values/placeholders 구성)
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
            // updated_at은 NOW()로 넣는 구조 유지
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
            updated: updatedMembers,
            inserted: newMembers, // 필요 없으면 빼도 됨
            upsertedCount: members.length,
            skippedNonNumeric: skipped, // ✅ 문자/UUID로 시작해서 제외된 수
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    } finally {
        client.release();
    }
}
