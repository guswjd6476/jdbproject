// app/api/cron/missing-report/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const cronSecret = process.env.CRON_SECRET;
        const authHeader = request.headers.get('authorization');

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ success: false, error: '인증 실패' }, { status: 401 });
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
        const internalReportSecret = process.env.INTERNAL_REPORT_SECRET;

        const res = await fetch(`${baseUrl}/api/report/send-telegram`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(internalReportSecret ? { Authorization: `Bearer ${internalReportSecret}` } : {}),
            },
            body: JSON.stringify({
                periodType: 'daily',
            }),
            cache: 'no-store',
        });

        const json = await res.json();

        if (!res.ok || json?.success === false) {
            return NextResponse.json(
                {
                    success: false,
                    error: json?.error || 'cron 실행 실패',
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            result: json,
        });
    } catch (err: any) {
        console.error('[GET /api/cron/missing-report] error:', err);
        return NextResponse.json(
            {
                success: false,
                error: err?.message ?? 'cron 실행 실패',
            },
            { status: 500 }
        );
    }
}
