// app/api/report/send-telegram/route.ts
import { pool } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/app/lib/telegram';
import {
    buildMissingReportMessage,
    formatDateLocal,
    getMissingReportData,
    parseISODateOnly,
    type PeriodType,
} from '@/app/lib/missingReport';

export async function POST(request: NextRequest) {
    const client = await pool.connect();

    try {
        const authHeader = request.headers.get('authorization');
        const internalSecret = process.env.INTERNAL_REPORT_SECRET;

        if (internalSecret && authHeader !== `Bearer ${internalSecret}`) {
            return NextResponse.json({ success: false, error: '인증 실패' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const periodType = ((body?.periodType ?? 'daily') as string).trim() as PeriodType;
        const baseDate = parseISODateOnly(body?.baseDate) ?? formatDateLocal(new Date());

        if (!['daily', 'weekly', 'monthly'].includes(periodType)) {
            return NextResponse.json({ success: false, error: 'periodType 값 오류' }, { status: 400 });
        }

        const data = await getMissingReportData(client, baseDate, periodType);
        const message = buildMissingReportMessage(data);

        const telegramResult = await sendTelegramMessage(message);

        return NextResponse.json({
            success: true,
            sent: true,
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
            telegramResult,
        });
    } catch (err: any) {
        console.error('[POST /api/report/send-telegram] error:', err);
        return NextResponse.json(
            {
                success: false,
                error: err?.message ?? '텔레그램 발송 실패',
            },
            { status: 500 }
        );
    } finally {
        client.release();
    }
}
