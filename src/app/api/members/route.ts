import { pool } from '@/app/lib/db';
import { REGIONS } from '@/app/lib/types';
import { NextResponse, NextRequest } from 'next/server';
import { verifyToken } from '@/app/lib/auth';
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

export async function GET(req: NextRequest) {
    // 🔒 [자체 인증] 쿠키에서 토큰 꺼내기
    const token = req.cookies.get('token')?.value;
    if (!token) {
        return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    try {
        // 🔒 토큰 검증 및 이메일 추출
        const user = verifyToken(token);
        if (!user || typeof user !== 'object' || !('email' in user)) {
            return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
        }
        const email = user.email as string;

        // 🔒 이메일 기반 권한 판정
        const authInfo = getUserAuthInfo(email);
        if (authInfo.role === 'none') {
            return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
        }

        const client = await pool.connect();
        try {
            // 🔒 최고관리자(superAdmin)가 아니면 본인 소속 지역 데이터만 강제 제한
            let targetRegions = REGIONS;
            if (authInfo.role !== 'superAdmin') {
                const userRegion = authInfo.region ?? 'all';
                targetRegions = [userRegion];
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
            console.error('GET members error:', error);
            return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
        } finally {
            client.release();
        }
    } catch (err) {
        return NextResponse.json({ error: '인증에 실패했습니다.' }, { status: 401 });
    }
}

export async function POST(req: NextRequest) {
    // 🔒 [자체 인증] 쿠키에서 토큰 꺼내기
    const token = req.cookies.get('token')?.value;
    if (!token) {
        return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    try {
        // 🔒 토큰 검증 및 이메일 추출
        const user = verifyToken(token);
        if (!user || typeof user !== 'object' || !('email' in user)) {
            return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
        }
        const email = user.email as string;

        // 🔒 이메일 기반 권한 판정
        const authInfo = getUserAuthInfo(email);
        if (authInfo.role === 'none') {
            return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
        }

        let body;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: '잘못된 JSON 형식입니다.' }, { status: 400 });
        }

        const membersRaw: Member[] = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];

        if (membersRaw.length === 0) {
            return NextResponse.json({ error: '업로드할 데이터가 없습니다.' }, { status: 400 });
        }

        // 데이터 정제 및 고유번호가 "숫자로 시작"하는 것만 필터링
        const members = membersRaw
            .map((m) => ({
                ...m,
                순번: isNaN(Number(m.순번)) ? 0 : Number(m.순번),
                고유번호: (m.고유번호 ?? '').toString().trim(),
                이름: (m.이름 ?? '').trim(),
                등록구분: (m.등록구분 ?? '').trim(),
                등록상태: (m.등록상태 ?? '').trim(),
                등록사유: (m.등록사유 ?? '').trim(),
                지역: (m.지역 ?? '').trim(),
                구역: (m.구역 ?? '').trim(),
            }))
            .filter((m) => m.고유번호 && startsWithDigit(m.고유번호));

        // 🔒 [보안] 최고관리자가 아닌 경우 본인 담당 지역 외 데이터 수정 시 차단 (우회 차단)
        if (authInfo.role !== 'superAdmin') {
            const userRegion = authInfo.region ?? 'all';
            const hasViolation = members.some((m) => m.지역 !== userRegion);
            if (hasViolation) {
                return NextResponse.json(
                    { error: '본인 담당 지역 외의 데이터는 수정할 수 없습니다.' },
                    { status: 403 }
                );
            }
        }

        const skipped = membersRaw.length - members.length;

        if (members.length === 0) {
            return NextResponse.json({
                message: '성공 (업서트 대상 없음)',
                updated: [],
                inserted: [],
                upsertedCount: 0,
                skippedNonNumeric: skipped,
            });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 기존 데이터 조회로 변경 사항 판별
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

            // 대량 쿼리를 위한 플레이스홀더 생성
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
            console.error('POST members error:', err);
            return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
        } finally {
            client.release();
        }
    } catch (err) {
        return NextResponse.json({ error: '인증에 실패했습니다.' }, { status: 401 });
    }
}
