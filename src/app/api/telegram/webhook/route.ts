import { pool } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/app/lib/telegram';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { getTeachersDataDirectly, TeacherData } from '@/app/lib/teachersService';
import {
    buildMissingReportMessage,
    formatDateLocal,
    getMissingReportData,
    type PeriodType,
} from '@/app/lib/missingReport';
import { getWeekDateRange } from '@/app/lib/function';

dayjs.extend(isBetween);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const PAGE_SIZE = 15;

/* =====================================================
 * 📌 유틸리티 및 목표 달성 상수
 * ===================================================== */
const steps = ['발', '찾', '합', '섭', '복', '예정'] as const;
type Step = (typeof steps)[number];
const GOAL_MULTIPLIERS: Record<Step, number> = { 발: 30, 찾: 10, 합: 4, 섭: 2, 복: 1.5, 예정: 1 };
const WEEK_WEIGHTS: Record<number, Partial<Record<Step, number>>> = {
    0: { 발: 1 },
    1: { 발: 1, 찾: 1 },
    2: { 찾: 1, 합: 1 },
    3: { 합: 1 },
    4: { 섭: 1 },
    5: { 섭: 1, 복: 1 },
    6: { 복: 1 },
    7: {},
};
const REGIONS = ['도봉', '성북', '노원', '중랑', '강북', '대학', '새신자', '이음'];

const getUnit = (step: Step) => (['발', '찾', '합'].includes(step) ? 1 : 0.5);
const roundToUnit = (value: number, unit: number) => Math.round(value / unit) * unit;
const getWeekCount = (year: number, month: number) => (year < 2025 || (year === 2025 && month <= 8) ? 5 : 8);
const initSteps = <T>(initVal: () => T): Record<Step, T> =>
    steps.reduce((acc, step) => ({ ...acc, [step]: initVal() }), {} as Record<Step, T>);

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
        '• **목표 달성 현황**: `/목표달성` (당월 목표 현황 대시보드)',
        '• **미보고 확인**: `/미보고`, `/미보고 오늘`, `/미보고 이번주`, `/미보고 이번달`',
        '• **교사 요약**: `/교사요약` (전체 통계)',
        '• **교사 명단**: `/교사명단` (엑셀 파일 다운로드)',
        '• **지역별 현황**: `/지역별` (버튼을 눌러 지역/소팅 확인)',
    ].join('\n');
}

// 💡 "사랑-4" 등을 완벽히 '사랑'으로 치환하는 함수 (강북/중랑 관계없이 적용)
const extractTeamFromRaw = (raw?: string) => {
    let t = (raw ?? '').trim();
    if (!t) return '';
    t = t.replace(/[–—]/g, '-');
    if (t.includes('사랑')) return '사랑';
    if (t.includes('-')) t = t.split('-')[0].trim();
    t = t.replace(/팀$/, '').trim();
    const m = t.match(/(\d+)/);
    return m ? m[1] : t;
};

/* =====================================================
 * 💬 텔레그램 메시지 API 함수들
 * ===================================================== */
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

/* =====================================================
 * 📊 [교사 현황] 데이터 처리 함수들
 * ===================================================== */
function buildRegionKeyboard(currentRegion: string, currentSort: string, page: number, totalPages: number) {
    const inline_keyboard: any[][] = [];
    let currentRow: any[] = [];

    const allRegions = ['전체', ...REGIONS];
    allRegions.forEach((region) => {
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

    if (currentRow.length > 0) inline_keyboard.push(currentRow);

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
            { text: '⬅️ 이전', callback_data: `tg:${currentRegion}:${currentSort}:${Math.max(1, page - 1)}` },
            { text: `${page}/${totalPages}`, callback_data: 'ignore' },
            { text: '➡️ 다음', callback_data: `tg:${currentRegion}:${currentSort}:${Math.min(totalPages, page + 1)}` },
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
                `   └ 관리건수 : ${t.c이상건수}건\n` +
                `   └ 실명단 : ${t.섭외자목록 || '없음'}`
            );
        })
        .join('\n\n');

    return {
        text: title + body,
        totalPages,
    };
}

/* =====================================================
 * 🎯 [목표 달성] 데이터 처리 및 대시보드 렌더링 함수
 * ===================================================== */
async function generateGoalReport(year: number, month: number, offset: number, regionIdx: number, weekIdx: number) {
    const regionName = REGIONS[regionIdx];
    const weekCount = getWeekCount(year, month);

    // 1. 설정(목표) 불러오기
    const configResult = await pool.query(
        'SELECT 예정_goals FROM region_configs WHERE year = $1 AND month = $2 AND region = $3',
        [year, month, regionName],
    );
    let fGoals: Record<string, string> = {};
    if (configResult.rows.length > 0) {
        fGoals =
            typeof configResult.rows[0].예정_goals === 'string'
                ? JSON.parse(configResult.rows[0].예정_goals)
                : configResult.rows[0].예정_goals;
    }

    const teamsInfo: any[] = [];
    Object.entries(fGoals).forEach(([teamKey, goalStr]) => {
        let teamName = teamKey.replace('team', '');
        // 중랑 지역이고 team4에 값이 있으면 사랑팀으로 강제 매핑 (프론트 로직 동일)
        if (regionName === '중랑' && teamKey === 'team4') teamName = '사랑';

        const 예정Goal = Number(goalStr ?? 0);
        if (예정Goal <= 0) return;

        // 월간/주간 목표 분배 계산
        const monthlyGoals = initSteps(() => 0);
        steps.forEach((s) => (monthlyGoals[s] = roundToUnit(예정Goal * GOAL_MULTIPLIERS[s], getUnit(s))));

        const weights = Array.from({ length: weekCount }).map((_, idx) => WEEK_WEIGHTS[idx] ?? {});
        const weeklyGoals = Array.from({ length: weekCount }).map(() => initSteps(() => 0));

        steps.forEach((step) => {
            const totalGoal = monthlyGoals[step];
            if (!totalGoal) return;
            const unit = getUnit(step);
            const totalUnits = Math.round(totalGoal / unit);
            let wArr = weights.map((w) => w[step] ?? 0);
            let wSum = wArr.reduce((a, b) => a + b, 0);
            if (wSum === 0) {
                wArr = Array(weekCount).fill(1);
                wSum = weekCount;
            }

            const quotas = wArr.map((w) => (totalUnits * w) / wSum);
            const unitsPerWeek = quotas.map((q) => Math.floor(q));
            let remain = totalUnits - unitsPerWeek.reduce((a, b) => a + b, 0);
            const remainders = quotas.map((q, i) => ({ i, r: q - Math.floor(q) })).sort((a, b) => b.r - a.r);

            let idx = 0;
            while (remain > 0) {
                unitsPerWeek[remainders[idx % weekCount].i] += 1;
                remain -= 1;
                idx += 1;
            }
            unitsPerWeek.forEach((val, i) => {
                weeklyGoals[i][step] = val * unit;
            });
        });

        teamsInfo.push({ team: teamName, monthlyGoals, weeklyGoals });
    });

    // 2. 실적(학생) 불러오기 및 계산
    const studentResult = await pool.query('SELECT * FROM students');
    const achievements: any = {}; // team -> week -> step -> {all, target}

    studentResult.rows.forEach((s) => {
        const lRegion = (s.인도자지역 ?? '').trim();
        const tRegion = (s.교사지역 ?? '').trim();
        const lTeam = extractTeamFromRaw(s.인도자팀);
        const tTeam = extractTeamFromRaw(s.교사팀);
        const isTargetMonth = s.target === `${month}월`;

        steps.forEach((step) => {
            // DB 컬럼명 매핑 처리
            const stepColMap: Record<string, string> = {
                발: '발 완료일',
                찾: '찾 완료일',
                합: '합 완료일',
                섭: '섭 완료일',
                복: '복 완료일',
                예정: '만남예정일자',
            };
            const dateStr = s[stepColMap[step]];
            if (!dateStr) return;
            const date = dayjs(dateStr);
            if (!date.isValid()) return;

            const isHalfScore = ['섭', '복', '예정'].includes(step);
            const targets = isHalfScore
                ? [
                      { r: lRegion, t: lTeam, score: 0.5 },
                      { r: tRegion, t: tTeam, score: 0.5 },
                  ]
                : [{ r: lRegion, t: lTeam, score: 1 }];

            targets.forEach(({ r, t, score }) => {
                // 현재 조회 중인 지역과 일치하는 데이터만 처리
                if (r !== regionName || !t) return;

                for (let i = 0; i < weekCount; i++) {
                    const { start, end } = getWeekDateRange(year, month, i + offset);
                    if (date.isBetween(start, end, 'day', '[]')) {
                        achievements[t] ??= {};
                        achievements[t][i] ??= initSteps(() => ({ all: 0, target: 0 }));
                        achievements[t][i][step].all += score;
                        if (['발', '찾'].includes(step) || isTargetMonth) {
                            achievements[t][i][step].target += score;
                        }
                    }
                }
            });
        });
    });

    // 3. 메시지 텍스트 조립
    const { display } = getWeekDateRange(year, month, weekIdx + offset);
    let text = `🎯 **${year}년 ${month}월 [${regionName}] 목표 현황**\n`;
    text += `🗓 **${weekIdx + 1}주차** (${display}) | 지연: ${offset}주\n\n`;

    if (teamsInfo.length === 0) {
        text += `⚠️ 설정된 목표가 없습니다.`;
    } else {
        teamsInfo.forEach((team) => {
            text += `🔹 **[${team.team}팀]**\n`;

            steps.forEach((s) => {
                const weeklyGoal = team.weeklyGoals[weekIdx]?.[s] || 0;
                const totalGoal = team.monthlyGoals[s] || 0;

                // 주간 누적 계산
                let cumDone = 0;
                const wkDone = achievements[team.team]?.[weekIdx]?.[s]?.target || 0;
                for (let i = 0; i <= weekIdx; i++) {
                    cumDone += achievements[team.team]?.[i]?.[s]?.target || 0;
                }

                const wRate = weeklyGoal > 0 ? ((wkDone / weeklyGoal) * 100).toFixed(0) : '0';
                const cRate = totalGoal > 0 ? ((cumDone / totalGoal) * 100).toFixed(0) : '0';

                text += `  • ${s}: 주간 ${wkDone}|${weeklyGoal} (${wRate}%) / 누적 ${cumDone}|${totalGoal} (${cRate}%)\n`;
            });
            text += `\n`;
        });
    }

    // 4. 인라인 키보드 조립 (callback_data: gl:{y}:{m}:{o}:{rg}:{w})
    const kb: any[][] = [];

    // 1행: 월 조작
    const prevM = month === 1 ? 12 : month - 1;
    const prevY = month === 1 ? year - 1 : year;
    const nextM = month === 12 ? 1 : month + 1;
    const nextY = month === 12 ? year + 1 : year;

    kb.push([
        { text: `◀️ ${prevM}월`, callback_data: `gl:${prevY - 2000}:${prevM}:${offset}:${regionIdx}:0` },
        { text: `📅 ${year}.${month}`, callback_data: 'ignore' },
        { text: `${nextM}월 ▶️`, callback_data: `gl:${nextY - 2000}:${nextM}:${offset}:${regionIdx}:0` },
    ]);

    // 2행: 지연(offset) 조작
    kb.push([
        {
            text: offset === 0 ? `✅ 0주 지연` : `0주 지연`,
            callback_data: `gl:${year - 2000}:${month}:0:${regionIdx}:${weekIdx}`,
        },
        {
            text: offset === 1 ? `✅ 1주 지연` : `1주 지연`,
            callback_data: `gl:${year - 2000}:${month}:1:${regionIdx}:${weekIdx}`,
        },
        {
            text: offset === 2 ? `✅ 2주 지연` : `2주 지연`,
            callback_data: `gl:${year - 2000}:${month}:2:${regionIdx}:${weekIdx}`,
        },
    ]);

    // 3행: 지역 조작 (4개씩 분할)
    kb.push(
        REGIONS.slice(0, 4).map((r, i) => ({
            text: regionIdx === i ? `✅ ${r}` : r,
            callback_data: `gl:${year - 2000}:${month}:${offset}:${i}:0`,
        })),
    );
    kb.push(
        REGIONS.slice(4, 8).map((r, i) => ({
            text: regionIdx === i + 4 ? `✅ ${r}` : r,
            callback_data: `gl:${year - 2000}:${month}:${offset}:${i + 4}:0`,
        })),
    );

    // 4행: 주차 조작
    const weekNav: any[] = [];
    if (weekIdx > 0)
        weekNav.push({
            text: `◀️ ${weekIdx}주차`,
            callback_data: `gl:${year - 2000}:${month}:${offset}:${regionIdx}:${weekIdx - 1}`,
        });
    weekNav.push({ text: `📖 ${weekIdx + 1}주차`, callback_data: 'ignore' });
    if (weekIdx < weekCount - 1)
        weekNav.push({
            text: `${weekIdx + 2}주차 ▶️`,
            callback_data: `gl:${year - 2000}:${month}:${offset}:${regionIdx}:${weekIdx + 1}`,
        });
    kb.push(weekNav);

    return { text, replyMarkup: { inline_keyboard: kb } };
}

/* =====================================================
 * 🚀 메인 POST 핸들러
 * ===================================================== */
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

            if (dataStr === 'ignore') {
                return NextResponse.json({ ok: true });
            }

            // 🎯 [신규] 목표 달성 대시보드 버튼 처리 (gl:)
            if (dataStr && dataStr.startsWith('gl:')) {
                const [_, yStr, mStr, oStr, rgStr, wStr] = dataStr.split(':');
                const [y, m, o, rg, w] = [Number(yStr) + 2000, Number(mStr), Number(oStr), Number(rgStr), Number(wStr)];

                const report = await generateGoalReport(y, m, o, rg, w);
                await editTelegramMessage(chatId, messageId, report.text, report.replyMarkup);

                await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ callback_query_id: callbackQuery.id }),
                });
                return NextResponse.json({ ok: true });
            }

            // 👥 [기존] 교사 현황 버튼 처리 (tg:)
            if (dataStr && dataStr.startsWith('tg:')) {
                const [_, region, sort, pageStr] = dataStr.split(':');
                const page = Number(pageStr || 1);

                const rows = await getTeachersDataDirectly();
                const result = generateReportText(rows, region, sort, page);
                const keyboard = buildRegionKeyboard(region, sort, page, result.totalPages);

                await editTelegramMessage(chatId, messageId, result.text, keyboard);

                await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ callback_query_id: callbackQuery.id }),
                });
                return NextResponse.json({ ok: true });
            }

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
        const isGoalCommand = text === '/목표달성';
        const isTeacherSummary = text === '/교사요약';
        const isTeacherList = text === '/교사명단';
        const isRegionCommand = text === '/지역별';
        const isMissingCommand =
            text === '/미보고' || text === '/미보고 오늘' || text === '/미보고 이번주' || text === '/미보고 이번달';

        if (isHelpCommand) {
            await sendTelegramMessage(buildHelpMessage(), chatId);
            return NextResponse.json({ ok: true });
        }

        // 🎯 [신규] 목표 달성 명령어 초기 진입
        if (isGoalCommand) {
            await sendTelegramMessage('📊 실시간 목표 달성 데이터를 계산 중입니다...', chatId);

            const now = new Date();
            // 기본값: 당해, 당월, 0주 지연, 도봉(0번), 0주차
            const report = await generateGoalReport(now.getFullYear(), now.getMonth() + 1, 0, 0, 0);

            await fetch(`${TELEGRAM_API}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: report.text,
                    parse_mode: 'Markdown',
                    reply_markup: report.replyMarkup,
                }),
            });
            return NextResponse.json({ ok: true });
        }

        // 👥 교사 요약 명령어
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

        // 📁 교사 명단(엑셀) 명령어
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

        // 📍 지역별 명령어
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

        // 🚨 미보고 명령어
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
