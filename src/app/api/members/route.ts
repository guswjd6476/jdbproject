import { pool } from '@/app/lib/db';
import { REGIONS } from '@/app/lib/types';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next'; // 💡 이것만 있으면 됩니다!
import { getUserAuthInfo } from '@/app/lib/authUtils';

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
    // 🔒 [C4 보안 보완] 인자 값 없이 세션을 가져옵니다.
    const session = await getServerSession();
    if (!session || !session.user?.email) {
        return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // 🔒 [C4 보안 보완] 내 authUtils를 사용하여 이메일로 권한 판정
    const authInfo = getUserAuthInfo(session.user.email);
    if (authInfo.role === 'none') {
        return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const client = await pool.connect();
    try {
        // 🔒 최고관리자(superAdmin)가 아니면 본인 소속 지역 데이터만 보게 강제 제한
        let targetRegions = REGIONS;
        if (authInfo.role !== 'superAdmin' && authInfo.region) {
            targetRegions = [authInfo.region];
        }

        const query = `
      SELECT
        지역,
        split_part(구역, '-', 1) AS 팀,
        COUNT(*) AS 재적
      FROM members
      WHERE 지역 = ANY($1)
      GROUP BY 지역, 팀
    `;
        const values = [targetRegions];
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
    // 🔒 [C4 보안 보완] 인자 값 없이 세션을 가져옵니다.
    const session = await getServerSession();
    if (!session || !session.user?.email) {
        return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // 🔒 [C4 보안 보완] 내 authUtils를 사용하여 이메일로 권한 판정
    const authInfo = getUserAuthInfo(session.user.email);
    if (authInfo.role === 'none') {
        return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const membersRaw: Member[] = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];

    if (!Array.isArray(membersRaw) || membersRaw.length === 0) {
        return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
    }

    // 고유번호가 "숫자로 시작"하는 것만 업서트 대상
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

    // 🔒 [C4 보안 보완] 최고관리자가 아닌데 다른 지역 데이터를 바꾸려고 하면 튕겨냄 (우회 차단)
    if (authInfo.role !== 'superAdmin' && authInfo.region) {
        const hasViolation = members.some((m) => m.지역 !== authInfo.region);
        if (hasViolation) {
            return NextResponse.json({ error: '본인 담당 지역 외의 데이터는 수정할 수 없습니다.' }, { status: 403 });
        }
    }

    const skipped = membersRaw.length - members.length;

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

        const ids = members.map((m) => m.고유번호);
        const { rows: existingMembers } = await client.query(
            `SELECT 순번, 이름, 고유번호, 등록구분, 등록상태, 등록사유, 지역, 구역
       FROM members
       WHERE 고유번호 = ANY($1)`,
            [ids]
        );

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
            updated: updatedMembers,
            inserted: newMembers,
            upsertedCount: members.length,
            skippedNonNumeric: skipped,
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    } finally {
        client.release();
    }
}
