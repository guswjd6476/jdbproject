// app/api/telegram/webhook/route.ts
import { pool } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/app/lib/telegram';
import * as XLSX from 'xlsx';
import { getTeachersDataDirectly, TeacherData } from '@/app/lib/teachersService';
import {
    buildMissingReportMessage,
    formatDateLocal,
    getMissingReportData,
    type PeriodType,
} from '@/app/lib/missingReport';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const PAGE_SIZE = 15;
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
        '📌 **사용 가능한 전체 명령어 안내**\n',
        '• **미보고 확인**: `/미보고`, `/미보고 오늘`, `/미보고 이번주`, `/미보고 이번달`',
        '• **교사 요약**: `/교사요약` (전체 통계)',
        '• **교사 명단**: `/교사명단` (엑셀 파일 다운로드)',
        '• **지역별 현황**: `/지역별` (버튼을 눌러 지역/소팅 확인)',
    ].join('\n');
}

async function editTelegramMessage(chatId: number, messageId: number, text: string, replyMarkup: any) {
    await fetch(`${TELEGRAM_API}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text,
            parse_mode: 'Markdown',
            reply_markup: replyMarkup,
        }),
    });
}

async function sendTelegramDocument(chatId: number, fileBuffer: any, filename: string) {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    const blob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    formData.append('document', blob, filename);

    await fetch(`${TELEGRAM_API}/sendDocument`, {
        method: 'POST',
        body: formData,
    });
}

// 갱신된 지역 리스트 반영 및 3열 자동 배치 키보드 빌더
function buildRegionKeyboard(currentRegion: string, currentSort: string, page: number, totalPages: number) {
    const regions = ['전체', '도봉', '성북', '노원', '중랑', '강북', '대학', '새신자', '이음'];

    const inline_keyboard: any[][] = [];
    let currentRow: any[] = [];

    regions.forEach((region) => {
        const isSelected = currentRegion === region;
        const displayRegion = region === '전체' ? '청년회 전체' : region;

        currentRow.push({
            text: isSelected ? `✅ ${displayRegion}` : displayRegion,
            callback_data: `tg:${region}:${currentSort}:${page}`,
        });

        if (currentRow.length === 3) {
            inline_keyboard.push(currentRow);
            currentRow = [];
        }
    });

    if (currentRow.length > 0) {
        inline_keyboard.push(currentRow);
    }

    inline_keyboard.push([
        {
            text: currentSort === 'name' ? '🔠 이름순 정렬 중' : '정렬: 이름순',
            callback_data: `tg:${currentRegion}:name:1`,
        },
        {
            text: currentSort === 'count' ? '🔥 섭외자수순 정렬 중' : '정렬: 섭외자수',
            callback_data: `tg:${currentRegion}:count:1`,
        },
    ]);

    if (totalPages > 1) {
        inline_keyboard.push([
            {
                text: '⬅️ 이전',
                callback_data: `tg:${currentRegion}:${currentSort}:${Math.max(1, page - 1)}`,
            },
            {
                text: `${page}/${totalPages}`,
                callback_data: 'ignore',
            },
            {
                text: '➡️ 다음',
                callback_data: `tg:${currentRegion}:${currentSort}:${Math.min(totalPages, page + 1)}`,
            },
        ]);
    }

    return { inline_keyboard };
}

function generateReportText(rows: TeacherData[], region: string, sort: string, page: number) {
    let list = rows.filter((t) => !t.fail);

    if (region !== '전체') {
        list = list.filter((t) => t.지역 === region);
    }

    if (sort === 'name') {
        list.sort((a, b) => a.이름.localeCompare(b.이름));
    } else {
        list.sort((a, b) => b.c이상건수 - a.c이상건수);
    }

    const totalCount = list.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    const start = (page - 1) * PAGE_SIZE;
    const pagedList = list.slice(start, start + PAGE_SIZE);

    const title =
        `📍 지역별 교사 활동 현황\n` +
        `[${region}] / ${sort === 'name' ? '이름순' : '섭외자수순'}\n` +
        `페이지 ${page}/${totalPages}\n` +
        `전체 ${totalCount}명\n\n`;

    const body = pagedList
        .map((t, idx) => {
            const teamInfo = t.구역 ? `${t.구역.split('-')[0]}팀` : '미지정';

            return (
                `${start + idx + 1}. ${t.이름}\n` +
                `   └ ${t.지역} / ${teamInfo} / ${t.활동여부}\n` +
                `   └ 관리건수 : ${t.c이상건수}건`
            );
        })
        .join('\n\n');

    return {
        text: title + body,
        totalPages,
    };
}
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // -----------------------------------------
        // [A] 인라인 버튼 클릭 이벤트 처리
        // -----------------------------------------
        if (body.callback_query) {
            const callbackQuery = body.callback_query;
            const chatId = callbackQuery.message.chat.id;
            const messageId = callbackQuery.message.message_id;
            const dataStr = callbackQuery.data;

            if (dataStr && dataStr.startsWith('tg:')) {
                const [_, region, sort, pageStr] = dataStr.split(':');

                if (region === 'ignore') {
                    return NextResponse.json({ ok: true });
                }

                const page = Number(pageStr || 1);

                const rows = await getTeachersDataDirectly();

                const result = generateReportText(rows, region, sort, page);

                const keyboard = buildRegionKeyboard(region, sort, page, result.totalPages);

                await editTelegramMessage(chatId, messageId, result.text, keyboard);
            }

            await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: callbackQuery.id }),
            });

            return NextResponse.json({ ok: true });
        }

        // -----------------------------------------
        // [B] 일반 텍스트 명령어 처리
        // -----------------------------------------
        const message = body?.message ?? body?.edited_message;
        const chatId = message?.chat?.id;
        const textRaw = message?.text;

        if (!chatId || !textRaw || typeof textRaw !== 'string') {
            return NextResponse.json({ ok: true });
        }

        const text = normalizeText(textRaw);

        const isHelpCommand = text === '/help' || text === '/도움말';
        const isTeacherSummary = text === '/교사요약';
        const isTeacherList = text === '/교사명단';
        const isRegionCommand = text === '/지역별';
        const isMissingCommand =
            text === '/미보고' || text === '/미보고 오늘' || text === '/미보고 이번주' || text === '/미보고 이번달';

        if (isHelpCommand) {
            await sendTelegramMessage(buildHelpMessage(), chatId);
            return NextResponse.json({ ok: true });
        }

        if (isTeacherSummary) {
            await sendTelegramMessage('🔄 교사 현황 데이터를 집계 중입니다...', chatId);
            const rows = await getTeachersDataDirectly();

            let 총 = 0,
                활동 = 0,
                비활동 = 0,
                탈락 = 0;
            rows.forEach((t) => {
                if (t.fail) 탈락++;
                else {
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
                '상세 리스트를 보려면 `/지역별` 또는 `/교사명단`을 입력하세요.',
            ].join('\n');

            await sendTelegramMessage(summaryMessage, chatId);
            return NextResponse.json({ ok: true });
        }

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

        if (isRegionCommand) {
            const rows = await getTeachersDataDirectly();
            const result = generateReportText(rows, '전체', 'name', 1);

            const keyboard = buildRegionKeyboard('전체', 'name', 1, result.totalPages);
            await fetch(`${TELEGRAM_API}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: result.text,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard,
                }),
            });
            return NextResponse.json({ ok: true });
        }

        if (isMissingCommand) {
            const client = await pool.connect();
            try {
                const periodType = parsePeriodFromText(text);
                const baseDate = formatDateLocal(new Date());

                const data = await getMissingReportData(client, baseDate, periodType);
                const reply = buildMissingReportMessage(data);

                await sendTelegramMessage(reply, chatId);
                return NextResponse.json({ ok: true });
            } finally {
                client.release();
            }
        }

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('[POST /api/telegram/webhook] error:', err);
        return NextResponse.json({ ok: false, error: err?.message ?? 'webhook 처리 실패' }, { status: 500 });
    }
}
