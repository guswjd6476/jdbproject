import { pool } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/app/lib/auth';
import type { JwtPayload } from 'jsonwebtoken';
// import { getMemberTableQueryCondition } from '@/app/lib/authUtils';

type PeriodType = 'daily' | 'weekly' | 'monthly';
type Scope = 'all' | 'region';
type GroupBy = 'region' | 'region_team' | 'team' | 'team_subteam';

const EXCLUDED_REGIONS = ['지교회', '타부서', '타지파'];

function parseISODateOnly(input?: string | null): string | null {
    if (!input) return null;
    const s = input.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    return s;
}

function formatDateLocal(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getPeriodRange(baseDate: string, periodType: PeriodType) {
    const d = new Date(`${baseDate}T00:00:00`);

    if (periodType === 'daily') {
        return { from: baseDate, to: baseDate };
    }

    if (periodType === 'weekly') {
        const day = d.getDay(); // 0=일, 1=월, ... 6=토
        const diffToMonday = day === 0 ? 6 : day - 1;

        const monday = new Date(d);
        monday.setDate(d.getDate() - diffToMonday);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        return {
            from: formatDateLocal(monday),
            to: formatDateLocal(sunday),
        };
    }

    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);

    return {
        from: formatDateLocal(first),
        to: formatDateLocal(last),
    };
}

export async function GET(request: NextRequest) {
    const client = await pool.connect();

    try {
        const token = request.cookies.get('token')?.value;
        let userEmail = '';

        if (token) {
            try {
                const decoded = verifyToken(token);
                if (decoded && typeof decoded === 'object' && 'email' in decoded) {
                    userEmail = (decoded as JwtPayload).email ?? '';
                }
            } catch {
                userEmail = '';
            }
        }

        const sp = request.nextUrl.searchParams;

        const scope = (sp.get('scope') ?? 'all').trim() as Scope;
        const groupBy = (sp.get('groupBy') ?? 'region').trim() as GroupBy;
        const periodType = (sp.get('periodType') ?? 'weekly').trim() as PeriodType;
        const baseDate = parseISODateOnly(sp.get('baseDate')) ?? formatDateLocal(new Date());
        const region = (sp.get('region') ?? '').trim();

        if (!['all', 'region'].includes(scope)) {
            return NextResponse.json({ success: false, error: 'scope 값 오류' }, { status: 400 });
        }

        if (!['region', 'region_team', 'team', 'team_subteam'].includes(groupBy)) {
            return NextResponse.json({ success: false, error: 'groupBy 값 오류' }, { status: 400 });
        }

        if (!['daily', 'weekly', 'monthly'].includes(periodType)) {
            return NextResponse.json({ success: false, error: 'periodType 값 오류' }, { status: 400 });
        }

        if (scope === 'region' && !region) {
            return NextResponse.json({ success: false, error: 'region 값이 필요합니다.' }, { status: 400 });
        }

        if (scope === 'region' && EXCLUDED_REGIONS.includes(region)) {
            return NextResponse.json({
                success: true,
                meta: {
                    scope,
                    groupBy,
                    periodType,
                    baseDate,
                    from: null,
                    to: null,
                    region,
                },
                rows: [],
            });
        }

        const { from, to } = getPeriodRange(baseDate, periodType);

        const values: any[] = [];
        const memberWhere: string[] = [];

        // 제외 지역
        values.push(EXCLUDED_REGIONS);
        memberWhere.push(`COALESCE(m.지역, '') <> ALL($${values.length})`);
        // 권한 필터
        // 반드시 m.지역 / m.구역 기준 조건을 반환해야 함
        // const permissionParam = getMemberTableQueryCondition(userEmail, 'm', values.length + 1);
        // if (permissionParam?.condition) {
        //     memberWhere.push(permissionParam.condition);
        //     if (permissionParam.values?.length) {
        //         values.push(...permissionParam.values);
        //     }
        // }

        if (scope === 'region') {
            values.push(region);
            memberWhere.push(`m.지역 = $${values.length}`);
        }

        values.push(from);
        const fromIdx = values.length;

        values.push(to);
        const toIdx = values.length;

        // 팀 추출 규칙
        // 현재는 구역 첫 글자를 팀으로 사용
        // 예: 2, 2-1, 2A => 팀 2
        const teamExpr = `
        COALESCE(
            NULLIF(
                CASE
                    WHEN POSITION('-' IN COALESCE(m.구역, '')) > 0
                        THEN SPLIT_PART(COALESCE(m.구역, ''), '-', 1)
                    ELSE COALESCE(m.구역, '')
                END,
                ''
            ),
            '(팀없음)'
        )
    `;
        const subteamExpr = `COALESCE(NULLIF(m.구역, ''), '(구역없음)')`;
        const regionExpr = `COALESCE(m.지역, '')`;

        let selectCols = '';
        let finalOrderBy = '';

        switch (groupBy) {
            case 'region':
                selectCols = `
                    ${regionExpr} AS region,
                    NULL::text AS team,
                    NULL::text AS subteam,
                    ${regionExpr} AS key
                `;
                finalOrderBy = `tc.region ASC, tc.key ASC`;
                break;

            case 'region_team':
                selectCols = `
                    ${regionExpr} AS region,
                    ${teamExpr} AS team,
                    NULL::text AS subteam,
                    ${regionExpr} || ' / ' || ${teamExpr} AS key
                `;
                finalOrderBy = `tc.region ASC, tc.team ASC, tc.key ASC`;
                break;

            case 'team':
                selectCols = `
                    ${regionExpr} AS region,
                    ${teamExpr} AS team,
                    NULL::text AS subteam,
                    ${teamExpr} AS key
                `;
                finalOrderBy = `tc.region ASC, tc.team ASC, tc.key ASC`;
                break;

            case 'team_subteam':
                selectCols = `
                    ${regionExpr} AS region,
                    ${teamExpr} AS team,
                    ${subteamExpr} AS subteam,
                    ${regionExpr} || ' / ' || ${teamExpr} || ' / ' || ${subteamExpr} AS key
                `;
                finalOrderBy = `tc.region ASC, tc.team ASC, tc.subteam ASC, tc.key ASC`;
                break;
        }

        const memberWhereSql = memberWhere.length ? `WHERE ${memberWhere.join(' AND ')}` : '';

        const sql = `
            WITH member_base AS (
                SELECT
                    m.고유번호,
                    ${selectCols}
                FROM members m
                ${memberWhereSql}
            ),
            total_counts AS (
                SELECT
                    key,
                    region,
                    team,
                    subteam,
                    COUNT(*)::int AS total_members
                FROM member_base
                GROUP BY key, region, team, subteam
            ),
            active_counts AS (
                SELECT
                    mb.key,
                    COUNT(DISTINCT a.member_id)::int AS active_members
                FROM member_base mb
                JOIN member_activities a
                  ON a.member_id = mb.고유번호
                 AND a.activity_date >= $${fromIdx}
                 AND a.activity_date <= $${toIdx}
                GROUP BY mb.key
            )
            SELECT
                tc.key,
                tc.region,
                tc.team,
                tc.subteam,
                tc.total_members,
                COALESCE(ac.active_members, 0) AS active_members,
                ROUND(
                    CASE
                        WHEN tc.total_members = 0 THEN 0
                        ELSE (COALESCE(ac.active_members, 0)::numeric / tc.total_members::numeric) * 100
                    END,
                    2
                ) AS activity_rate,
                TO_CHAR($${fromIdx}::date, 'YYYY-MM-DD') AS start_date,
                TO_CHAR($${toIdx}::date, 'YYYY-MM-DD') AS end_date,
                TO_CHAR($${toIdx}::date, 'YYYY-MM-DD') AS base_date,
                '${periodType}'::text AS period_type
            FROM total_counts tc
            LEFT JOIN active_counts ac
              ON tc.key = ac.key
            ORDER BY ${finalOrderBy}
        `;

        const res = await client.query(sql, values);

        return NextResponse.json({
            success: true,
            meta: {
                scope,
                groupBy,
                periodType,
                baseDate,
                from,
                to,
                region: region || null,
            },
            rows: res.rows,
        });
    } catch (err: any) {
        console.error('[GET /api/activity-rate] error:', err);
        return NextResponse.json(
            {
                success: false,
                error: err?.message ?? '활동율 조회 실패',
            },
            { status: 500 }
        );
    } finally {
        client.release();
    }
}
