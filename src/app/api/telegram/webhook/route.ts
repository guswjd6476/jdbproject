// app/api/telegram/webhook/route.ts
import { pool } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/app/lib/telegram';
import { getTeachersDataDirectly, TeacherData } from '@/app/lib/teachersService';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

function normalizeText(text: string) {
    return text.trim().replace(/\s+/g, ' ');
}

// 공통 메시지 수정 API 호출기 (인라인 버튼 반응용)
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

// 지역 선택 버튼 레이아웃 빌더
function buildRegionKeyboard(currentRegion: string, currentSort: string) {
    return {
        inline_keyboard: [
            [
                {
                    text: currentRegion === '전체' ? '✅ 청년회(전체)' : '청년회(전체)',
                    callback_data: `tg:전체:${currentSort}`,
                },
                { text: currentRegion === '도봉' ? '✅ 도봉' : '도봉', callback_data: `tg:도봉:${currentSort}` },
            ],
            [
                { text: currentRegion === '성북' ? '✅ 성북' : '성북', callback_data: `tg:성북:${currentSort}` },
                { text: currentRegion === '노원' ? '✅ 노원' : '노원', callback_data: `tg:노원:${currentSort}` },
            ],
            [
                {
                    text: currentSort === 'name' ? '🔠 이름순 정렬 중' : 'Sorting: 이름순',
                    callback_data: `tg:${currentRegion}:name`,
                },
                {
                    text: currentSort === 'count' ? '🔥 섭외자 많은순 정렬 중' : 'Sorting: 섭외자수',
                    callback_data: `tg:${currentRegion}:count`,
                },
            ],
        ],
    };
}

// 데이터 필터링 및 텍스트 렌더링 엔진
function generateReportText(rows: TeacherData[], region: string, sort: string): string {
    // 1. 탈락자 제외 및 지역 필터링
    let list = rows.filter((t) => !t.fail);
    if (region !== '전체') {
        list = list.filter((t) => t.지역 === region);
    }

    // 2. 소팅(정렬) 처리
    if (sort === 'name') {
        list.sort((a, b) => a.이름.localeCompare(b.이름));
    } else if (sort === 'count') {
        list.sort((a, b) => b.c이상건수 - a.c이상건수);
    }

    // 3. 마크다운 텍스트 조립
    const title = `📍 **지역별 교사 활동 현황 [${region} / ${sort === 'name' ? '이름순' : '섭외자수순'}]**\n`;
    const body = list
        .map((t, idx) => {
            return `${idx + 1}. **${t.이름}** (${t.지역}-${t.구역.split('-')[0]}팀 / ${t.활동여부})\n   └ 👥 섭외 대상자: _${t.섭외자목록}_\n   └ 총 관리 건수: ${t.c이상건수}건`;
        })
        .join('\n\n');

    return `${title}\n${body || '해당하는 교사가 없습니다.'}`;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // [A] 일반 텍스트 명령어 처리
        if (body.message) {
            const chatId = body.message.chat.id;
            const text = normalizeText(body.message.text ?? '');

            if (text === '/지역별') {
                const rows = await getTeachersDataDirectly();
                // 기본값: 전체 매칭, 이름순 정렬
                const report = generateReportText(rows, '전체', 'name');
                const keyboard = buildRegionKeyboard('전체', 'name');

                await fetch(`${TELEGRAM_API}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: report,
                        parse_mode: 'Markdown',
                        reply_markup: keyboard,
                    }),
                });
                return NextResponse.json({ ok: true });
            }
        }

        // [B] 인라인 버튼 클릭 (Callback Query) 처리
        if (body.callback_query) {
            const callbackQuery = body.callback_query;
            const chatId = callbackQuery.message.chat.id;
            const messageId = callbackQuery.message.message_id;
            const dataStr = callbackQuery.data; // 예: "tg:도봉:count"

            if (dataStr && dataStr.startsWith('tg:')) {
                const [_, region, sort] = dataStr.split(':');

                const rows = await getTeachersDataDirectly();
                const updatedReport = generateReportText(rows, region, sort);
                const updatedKeyboard = buildRegionKeyboard(region, sort);

                // 화면 깜빡임 없이 메시지 본문과 버튼 배열을 즉시 스왑
                await editTelegramMessage(chatId, messageId, updatedReport, updatedKeyboard);
            }

            // 텔레그램 서버에 리액션 응답 수신 전송 (상단 모래시계 뱅글뱅글 멈추는 용도)
            await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: callbackQuery.id }),
            });

            return NextResponse.json({ ok: true });
        }

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('[Telegram Webhook Error]:', err);
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
