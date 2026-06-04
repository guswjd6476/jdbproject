// app/api/telegram/webhook/route.ts
import { pool } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/app/lib/telegram';
import * as XLSX from 'xlsx';
import { getTeachersDataDirectly } from '@/app/lib/teachersService'; // 방금 만든 서비스 임포트
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
    return [
        '📌 사용 가능한 명령:',
        '• 미보고 확인: /미보고, /미보고 오늘, /미보고 이번주, /미보고 이번달',
        '• 교사 현황 요약: /교사요약',
        '• 교사 명단 엑셀: /교사명단',
    ].join('\n');
}

// 텔레그램 문서(엑셀) 전송용 헬퍼 함수
async function sendTelegramDocument(chatId: number, fileBuffer: any, filename: string) {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const formData = new FormData();
    formData.append('chat_id', String(chatId));

    const blob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    formData.append('document', blob, filename);

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
        method: 'POST',
        body: formData,
    });
}

export async function POST(request: NextRequest) {
    // 기존 미보고용 클라이언트 커넥션
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

        // 교사 관련 신규 명령어 조건
        const isTeacherSummary = text === '/교사요약';
        const isTeacherList = text === '/교사명단';

        // 1. 도움말 처리
        if (isHelpCommand) {
            await sendTelegramMessage(buildHelpMessage(), chatId);
            return NextResponse.json({ ok: true });
        }

        // 2. /교사요약 명령어 처리
        if (isTeacherSummary) {
            await sendTelegramMessage('🔄 교사 현황 데이터를 집계 중입니다...', chatId);

            // 만들어 두신 서비스 함수 바로 호출
            const rows = await getTeachersDataDirectly();

            let 총 = 0,
                활동 = 0,
                비활동 = 0,
                탈락 = 0;
            rows.forEach((t) => {
                if (t.fail) {
                    탈락++;
                } else {
                    총++;
                    if (t.활동여부 === '활동') 활동++;
                    else if (t.활동여부 === '비활동') 비활동++;
                }
            });

            const summaryMessage = [
                '📊 **[교사 현황 요약]**\n',
                `• 현재 교사 (탈락 제외): ${총}명`,
                `  - 🟢 활동 교사: ${활동}명`,
                `  - 🟡 비활동 교사: ${비활동}명`,
                `• 🔴 탈락 교사: ${탈락}명\n`,
                '전체 엑셀 명단이 필요하시면 /교사명단 을 입력하세요.',
            ].join('\n');

            await sendTelegramMessage(summaryMessage, chatId);
            return NextResponse.json({ ok: true });
        }

        // 3. /교사명단 명령어 처리 (엑셀 발송)
        if (isTeacherList) {
            await sendTelegramMessage('📁 교사 명단 엑셀 파일을 생성하고 있습니다...', chatId);

            const rows = await getTeachersDataDirectly();
            const currentTeachers = rows.filter((t) => !t.fail);

            const dataForExcel = currentTeachers.map((t) => ({
                고유번호: t.고유번호,
                이름: t.이름,
                지역: t.지역,
                구역: t.구역 ? `${String(t.구역).trim()}` : '',
                교사형태: t.교사형태,
                활동여부: t.활동여부,
                'C 이상 건수': t.c이상건수,
                '마지막 업데이트': t.마지막업데이트,
                등록사유: t.reason ?? '',
            }));

            const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, '교사명단');
            const fileBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

            await sendTelegramDocument(chatId, fileBuffer, '현재_교사_명단.xlsx');
            return NextResponse.json({ ok: true });
        }

        // 4. 기존 미보고 기능 처리
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
