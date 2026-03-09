// app/lib/telegram.ts

const TELEGRAM_MAX_MESSAGE_LENGTH = 3500;

function splitTelegramMessage(text: string, maxLength = TELEGRAM_MAX_MESSAGE_LENGTH): string[] {
    if (text.length <= maxLength) return [text];

    const lines = text.split('\n');
    const chunks: string[] = [];
    let current = '';

    for (const line of lines) {
        const next = current ? `${current}\n${line}` : line;

        if (next.length <= maxLength) {
            current = next;
            continue;
        }

        if (current) {
            chunks.push(current);
            current = '';
        }

        // 한 줄 자체가 너무 길면 강제로 자름
        if (line.length > maxLength) {
            let start = 0;
            while (start < line.length) {
                chunks.push(line.slice(start, start + maxLength));
                start += maxLength;
            }
        } else {
            current = line;
        }
    }

    if (current) {
        chunks.push(current);
    }

    return chunks;
}

async function sendSingleTelegramMessage(text: string, chatId: string | number) {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
        throw new Error('TELEGRAM_BOT_TOKEN 환경변수가 없습니다.');
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

export async function sendTelegramMessage(text: string, chatIdOverride?: string | number) {
    const defaultChatId = process.env.TELEGRAM_CHAT_ID;
    const chatId = chatIdOverride ?? defaultChatId;

    if (!chatId) {
        throw new Error('TELEGRAM_CHAT_ID 환경변수가 없습니다.');
    }

    const chunks = splitTelegramMessage(text);
    const results = [];

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks.length === 1 ? chunks[i] : `(${i + 1}/${chunks.length})\n${chunks[i]}`;

        const result = await sendSingleTelegramMessage(chunk, chatId);
        results.push(result);
    }

    return results;
}
