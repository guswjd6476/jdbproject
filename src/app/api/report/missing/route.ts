// app/api/report/missing/route.ts
import { pool } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import {
    buildMissingReportMessage,
    formatDateLocal,
    getMissingReportData,
    parseISODateOnly,
    type PeriodType,
} from '@/app/lib/missingReport';

export async function GET(request: NextRequest) {
    const client = await pool.connect();

    try {
        const sp = request.nextUrl.searchParams;
        const periodType = (sp.get('periodType') ?? 'daily').trim() as PeriodType;
        const baseDate = parseISODateOnly(sp.get('baseDate')) ?? formatDateLocal(new Date());

        if (!['daily', 'weekly', 'monthly'].includes(periodType)) {
            return NextResponse.json({ success: false, error: 'periodType 값 오류' }, { status: 400 });
        }

        const data = await getMissingReportData(client, baseDate, periodType);
        const message = buildMissingReportMessage(data);

        return NextResponse.json({
            success: true,
            meta: {
                baseDate: data.baseDate,
                periodType: data.periodType,
                from: data.from,
                to: data.to,
            },
            counts: {
                missingRegions: data.missingRegions.length,
                missingTeams: data.missingTeams.length,
                missingSubteams: data.missingSubteams.length,
            },
            rows: {
                missingRegions: data.missingRegions,
                missingTeams: data.missingTeams,
                missingSubteams: data.missingSubteams,
            },
            message,
        });
    } catch (err: any) {
        console.error('[GET /api/report/missing] error:', err);
        return NextResponse.json(
            {
                success: false,
                error: err?.message ?? '미보고 조회 실패',
            },
            { status: 500 }
        );
    } finally {
        client.release();
    }
}
