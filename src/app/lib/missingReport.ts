// app/lib/missingReport.ts
import type { PoolClient } from 'pg';

export type PeriodType = 'daily' | 'weekly' | 'monthly';

export const EXCLUDED_REGIONS = ['지교회', '타부서', '타지파'];

export function parseISODateOnly(input?: string | null): string | null {
    if (!input) return null;
    const s = input.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    return s;
}

export function formatDateLocal(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function getPeriodRange(baseDate: string, periodType: PeriodType) {
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

export function buildMissingReportMessage(params: {
    baseDate: string;
    periodType: PeriodType;
    from: string;
    to: string;
    missingRegions: Array<{ region: string; total_members: number }>;
    missingTeams: Array<{ region: string; team: string; total_members: number }>;
    missingSubteams: Array<{ region: string; team: string; subteam: string; total_members: number }>;
}) {
    const { baseDate, periodType, from, to, missingRegions, missingTeams, missingSubteams } = params;

    const periodLabel = periodType === 'daily' ? '일간' : periodType === 'weekly' ? '주간' : '월간';

    const lines: string[] = [];
    lines.push(`📋 <b>미보고 현황</b>`);
    lines.push(`기준일: ${baseDate}`);
    lines.push(`기간: ${periodLabel} (${from} ~ ${to})`);
    lines.push('');

    lines.push(`1) <b>미보고 지역</b>`);
    if (missingRegions.length === 0) {
        lines.push(`- 없음`);
    } else {
        for (const row of missingRegions) {
            lines.push(`- ${row.region} (인원 ${row.total_members})`);
        }
    }

    lines.push('');
    lines.push(`2) <b>미보고 팀</b>`);
    if (missingTeams.length === 0) {
        lines.push(`- 없음`);
    } else {
        for (const row of missingTeams) {
            lines.push(`- ${row.region} / ${row.team} (인원 ${row.total_members})`);
        }
    }

    lines.push('');
    lines.push(`3) <b>미보고 구역</b>`);
    if (missingSubteams.length === 0) {
        lines.push(`- 없음`);
    } else {
        for (const row of missingSubteams) {
            lines.push(`- ${row.region} / ${row.team} / ${row.subteam} (인원 ${row.total_members})`);
        }
    }

    return lines.join('\n');
}

export async function getMissingReportData(client: PoolClient, baseDate: string, periodType: PeriodType) {
    const { from, to } = getPeriodRange(baseDate, periodType);

    const values: any[] = [];
    values.push(EXCLUDED_REGIONS);
    const excludedIdx = values.length;

    values.push(from);
    const fromIdx = values.length;

    values.push(to);
    const toIdx = values.length;

    const regionExpr = `COALESCE(m.지역, '')`;

    // 1-2 -> 1
    // 사랑-1 -> 사랑
    // 10-3 -> 10
    // 하이픈 없으면 구역 전체를 팀으로 사용
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

    const missingRegionsSql = `
        WITH member_base AS (
            SELECT
                m.고유번호,
                ${regionExpr} AS region
            FROM members m
            WHERE COALESCE(m.지역, '') <> ALL($${excludedIdx})
        ),
        active_base AS (
            SELECT DISTINCT a.member_id
            FROM member_activities a
            WHERE a.activity_date >= $${fromIdx}
              AND a.activity_date <= $${toIdx}
        )
        SELECT
            mb.region,
            COUNT(*)::int AS total_members
        FROM member_base mb
        LEFT JOIN active_base ab
          ON ab.member_id = mb.고유번호
        GROUP BY mb.region
        HAVING COUNT(ab.member_id) = 0
        ORDER BY mb.region ASC
    `;

    const missingTeamsSql = `
        WITH member_base AS (
            SELECT
                m.고유번호,
                ${regionExpr} AS region,
                ${teamExpr} AS team
            FROM members m
            WHERE COALESCE(m.지역, '') <> ALL($${excludedIdx})
        ),
        active_base AS (
            SELECT DISTINCT a.member_id
            FROM member_activities a
            WHERE a.activity_date >= $${fromIdx}
              AND a.activity_date <= $${toIdx}
        )
        SELECT
            mb.region,
            mb.team,
            COUNT(*)::int AS total_members
        FROM member_base mb
        LEFT JOIN active_base ab
          ON ab.member_id = mb.고유번호
        GROUP BY mb.region, mb.team
        HAVING COUNT(ab.member_id) = 0
        ORDER BY mb.region ASC, mb.team ASC
    `;

    const missingSubteamsSql = `
        WITH member_base AS (
            SELECT
                m.고유번호,
                ${regionExpr} AS region,
                ${teamExpr} AS team,
                ${subteamExpr} AS subteam
            FROM members m
            WHERE COALESCE(m.지역, '') <> ALL($${excludedIdx})
        ),
        active_base AS (
            SELECT DISTINCT a.member_id
            FROM member_activities a
            WHERE a.activity_date >= $${fromIdx}
              AND a.activity_date <= $${toIdx}
        )
        SELECT
            mb.region,
            mb.team,
            mb.subteam,
            COUNT(*)::int AS total_members
        FROM member_base mb
        LEFT JOIN active_base ab
          ON ab.member_id = mb.고유번호
        GROUP BY mb.region, mb.team, mb.subteam
        HAVING COUNT(ab.member_id) = 0
        ORDER BY mb.region ASC, mb.team ASC, mb.subteam ASC
    `;

    const [regionsRes, teamsRes, subteamsRes] = await Promise.all([
        client.query(missingRegionsSql, values),
        client.query(missingTeamsSql, values),
        client.query(missingSubteamsSql, values),
    ]);

    return {
        baseDate,
        periodType,
        from,
        to,
        missingRegions: regionsRes.rows,
        missingTeams: teamsRes.rows,
        missingSubteams: subteamsRes.rows,
    };
}
