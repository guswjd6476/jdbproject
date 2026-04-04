import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { verifyToken } from '@/app/lib/auth';
import type { JwtPayload } from 'jsonwebtoken';
import { getMemberTableQueryCondition } from '@/app/lib/authUtils';

dayjs.extend(isoWeek);

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

type TokenPayload = JwtPayload & {
    email?: string;
};

export async function GET(req: NextRequest) {
    const client = await pool.connect();

    try {
        const authHeader = req.headers.get('authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies.get('token')?.value;

        if (!token) {
            return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
        }

        const decoded = verifyToken(token) as TokenPayload | string;

        if (!decoded || typeof decoded === 'string') {
            return NextResponse.json({ success: false, error: '유효하지 않은 토큰입니다.' }, { status: 401 });
        }

        const userEmail = decoded.email;

        if (!userEmail) {
            return NextResponse.json({ success: false, error: '토큰에 이메일 정보가 없습니다.' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const baseDate = searchParams.get('baseDate') || dayjs().format('YYYY-MM-DD');

        const weekStart = dayjs(baseDate).startOf('isoWeek').format('YYYY-MM-DD');
        const weekEnd = dayjs(baseDate).endOf('isoWeek').format('YYYY-MM-DD');

        const memberAuth = getMemberTableQueryCondition(userEmail, 'm', 3);
        const memberAuthSql = memberAuth.condition ? ` AND ${memberAuth.condition}` : '';
        const memberAuthValues = memberAuth.values ?? [];

        const activityAuth = getMemberTableQueryCondition(userEmail, 'm', 3);
        const activityAuthSql = activityAuth.condition ? ` AND ${activityAuth.condition}` : '';
        const activityAuthValues = activityAuth.values ?? [];

        const sql = `
            WITH base_groups AS (
                SELECT DISTINCT
                    m."지역" AS region,
                    split_part(COALESCE(m."구역", ''), '-', 1) AS team,
                    COALESCE(m."구역", '') AS subteam
                FROM members m
                WHERE 1=1
                ${memberAuthSql}
            ),

            activity_base AS (
                SELECT
                    m."지역" AS region,
                    split_part(COALESCE(m."구역", ''), '-', 1) AS team,
                    COALESCE(m."구역", '') AS subteam,
                    EXTRACT(ISODOW FROM a."activity_date"::date)::int AS iso_dow,
                    COUNT(DISTINCT a."member_id") AS active_count
                FROM member_activities a
                INNER JOIN members m
                    ON m."고유번호" = a."member_id"
                WHERE a."activity_date"::date BETWEEN $1::date AND $2::date
                ${activityAuthSql}
                GROUP BY
                    m."지역",
                    split_part(COALESCE(m."구역", ''), '-', 1),
                    COALESCE(m."구역", ''),
                    EXTRACT(ISODOW FROM a."activity_date"::date)
            ),

            weekly_unique AS (
                SELECT
                    m."지역" AS region,
                    split_part(COALESCE(m."구역", ''), '-', 1) AS team,
                    COALESCE(m."구역", '') AS subteam,
                    COUNT(DISTINCT a."member_id") AS total_active_members
                FROM member_activities a
                INNER JOIN members m
                    ON m."고유번호" = a."member_id"
                WHERE a."activity_date"::date BETWEEN $1::date AND $2::date
                ${activityAuthSql}
                GROUP BY
                    m."지역",
                    split_part(COALESCE(m."구역", ''), '-', 1),
                    COALESCE(m."구역", '')
            )

            SELECT
                g.region,
                g.team,
                g.subteam,
                COALESCE(SUM(CASE WHEN ab.iso_dow = 1 THEN ab.active_count ELSE 0 END), 0) AS monday_count,
                COALESCE(SUM(CASE WHEN ab.iso_dow = 2 THEN ab.active_count ELSE 0 END), 0) AS tuesday_count,
                COALESCE(SUM(CASE WHEN ab.iso_dow = 3 THEN ab.active_count ELSE 0 END), 0) AS wednesday_count,
                COALESCE(SUM(CASE WHEN ab.iso_dow = 4 THEN ab.active_count ELSE 0 END), 0) AS thursday_count,
                COALESCE(SUM(CASE WHEN ab.iso_dow = 5 THEN ab.active_count ELSE 0 END), 0) AS friday_count,
                COALESCE(SUM(CASE WHEN ab.iso_dow = 6 THEN ab.active_count ELSE 0 END), 0) AS saturday_count,
                COALESCE(SUM(CASE WHEN ab.iso_dow = 7 THEN ab.active_count ELSE 0 END), 0) AS sunday_count,
                COALESCE(wu.total_active_members, 0) AS total_active_members
            FROM base_groups g
            LEFT JOIN activity_base ab
                ON g.region = ab.region
               AND g.team = ab.team
               AND g.subteam = ab.subteam
            LEFT JOIN weekly_unique wu
                ON g.region = wu.region
               AND g.team = wu.team
               AND g.subteam = wu.subteam
            GROUP BY
                g.region, g.team, g.subteam, wu.total_active_members
            ORDER BY
                g.region NULLS LAST,
                g.team NULLS LAST,
                g.subteam NULLS LAST
        `;

        const values = [weekStart, weekEnd, ...activityAuthValues, ...activityAuthValues, ...memberAuthValues];

        const result = await client.query(sql, values);

        const rows = (result.rows || []).map((r) => {
            const counts = [
                Number(r.monday_count || 0),
                Number(r.tuesday_count || 0),
                Number(r.wednesday_count || 0),
                Number(r.thursday_count || 0),
                Number(r.friday_count || 0),
                Number(r.saturday_count || 0),
                Number(r.sunday_count || 0),
            ];

            const missing_days = DAY_LABELS.filter((_, idx) => counts[idx] === 0);

            return {
                key: `${r.region ?? ''}-${r.team ?? ''}-${r.subteam ?? ''}`,
                region: r.region,
                team: r.team,
                subteam: r.subteam || '',
                monday_count: counts[0],
                tuesday_count: counts[1],
                wednesday_count: counts[2],
                thursday_count: counts[3],
                friday_count: counts[4],
                saturday_count: counts[5],
                sunday_count: counts[6],
                total_active_members: Number(r.total_active_members || 0),
                reported_days_count: 7 - missing_days.length,
                missing_days,
                week_start: weekStart,
                week_end: weekEnd,
            };
        });

        return NextResponse.json({
            success: true,
            rows,
        });
    } catch (error: any) {
        console.error('[weekly-board error]', error);

        return NextResponse.json(
            {
                success: false,
                error: error?.message || '주간 현황 조회 실패',
            },
            { status: 500 }
        );
    } finally {
        client.release();
    }
}
