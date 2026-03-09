// app/api/telegram/set-webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        const internalSecret = process.env.INTERNAL_REPORT_SECRET;
        const authHeader = request.headers.get('authorization');

        if (internalSecret && authHeader !== `Bearer ${internalSecret}`) {
            return NextResponse.json({ success: false, error: '인증 실패' }, { status: 401 });
        }

        if (!token) {
            return NextResponse.json({ success: false, error: 'TELEGRAM_BOT_TOKEN 없음' }, { status: 500 });
        }

        if (!appUrl) {
            return NextResponse.json({ success: false, error: 'NEXT_PUBLIC_APP_URL 없음' }, { status: 500 });
        }

        const webhookUrl = `${appUrl}/api/telegram/webhook`;

        const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: webhookUrl,
            }),
        });

        const json = await res.json();

        if (!res.ok || !json?.ok) {
            return NextResponse.json(
                { success: false, error: json?.description || 'setWebhook 실패' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            webhookUrl,
            telegram: json,
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err?.message ?? 'setWebhook 실패' }, { status: 500 });
    }
}
