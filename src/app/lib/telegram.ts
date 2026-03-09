// app/lib/telegram.ts

export async function sendTelegramMessage(text: string, chatIdOverride?: string | number) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const defaultChatId = process.env.TELEGRAM_CHAT_ID;

    if (!token) {
        throw new Error('TELEGRAM_BOT_TOKEN 환경변수가 없습니다.');
    }

    const chatId = chatIdOverride ?? defaultChatId;

    if (!chatId) {
        throw new Error('TELEGRAM_CHAT_ID 환경변수가 없습니다.');
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
        }),
    });

    const json = await res.json();

    if (!res.ok || !json?.ok) {
        throw new Error(json?.description || '텔레그램 전송 실패');
    }

    return json;
}
