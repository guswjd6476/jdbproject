// app/api/telegram/webhook/route.ts
import { pool } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/app/lib/telegram';
import {
    buildMissingReportMessage,
    formatDateLocal,
    getMissingReportData,
    type PeriodType,
} from '@/app/lib/missingReport';

function normalizeText(text: string) {
    return text.trim().replace(/\s+/g, ' ');
}

function parsePeriodFromText(text: string): PeriodType {
    if (text.includes('이번주') || text.includes('주간')) return 'weekly';
    if (text.includes('이번달') || text.includes('월간')) return 'monthly';
    return 'daily';
}

function buildHelpMessage() {
    return ['사용 가능한 명령:', '/미보고', '/미보고 오늘', '/미보고 이번주', '/미보고 이번달'].join('\n');
}

export async function POST(request: NextRequest) {
    const client = await pool.connect();

    try {
        const body = await request.json();

        const message = body?.message ?? body?.edited_message;
        const chatId = message?.chat?.id;
        const textRaw = message?.text;

        if (!chatId || !textRaw || typeof textRaw !== 'string') {
            return NextResponse.json({ ok: true });
        }

        const text = normalizeText(textRaw);

        const isHelpCommand = text === '/help' || text === '/도움말';
        const isMissingCommand =
            text === '/미보고' || text === '/미보고 오늘' || text === '/미보고 이번주' || text === '/미보고 이번달';

        if (isHelpCommand) {
            await sendTelegramMessage(buildHelpMessage(), chatId);
            return NextResponse.json({ ok: true });
        }

        if (!isMissingCommand) {
            return NextResponse.json({ ok: true });
        }

        const periodType = parsePeriodFromText(text);
        const baseDate = formatDateLocal(new Date());

        const data = await getMissingReportData(client, baseDate, periodType);
        const reply = buildMissingReportMessage(data);

        await sendTelegramMessage(reply, chatId);

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('[POST /api/telegram/webhook] error:', err);
        return NextResponse.json({ ok: false, error: err?.message ?? 'webhook 처리 실패' }, { status: 500 });
    } finally {
        client.release();
    }
}
