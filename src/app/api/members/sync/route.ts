import { pool } from '@/app/lib/db';
import { NextResponse } from 'next/server';

const startsWith00 = (s: string) => (s ?? '').trim().startsWith('00');

export async function POST(request: Request) {
    const client = await pool.connect();
    try {
        const body = await request.json();

        const uploadedIdsRaw: string[] = Array.isArray(body?.uploadedIds) ? body.uploadedIds : [];
        const confirmDelete: boolean = body?.confirmDelete === true;
        const deleteIdsRaw: string[] = Array.isArray(body?.deleteIds) ? body.deleteIds : [];

        // ✅ sync 대상은 "00으로 시작"하는 고유번호만
        const uploadedIds = uploadedIdsRaw.map((x) => (x ?? '').trim()).filter((x) => x && startsWith00(x));

        // 1) 프리뷰: 이번 업로드에 없는 "00 시작 고유번호" 목록 반환
        if (!confirmDelete) {
            // 업로드된 00 시작 고유번호가 하나도 없으면, 실수로 전체 삭제 후보가 나오는 걸 방지
            if (uploadedIds.length === 0) {
                return NextResponse.json({
                    success: true,
                    toDelete: [],
                    message: '업로드된 "00 시작" 고유번호가 없어 삭제 후보를 계산하지 않았습니다.',
                });
            }

            const res = await client.query(
                `
        SELECT 고유번호, 이름, 지역, 구역
        FROM members
        WHERE 고유번호 LIKE '00%'
          AND NOT (고유번호 = ANY($1))
        ORDER BY 지역, 구역, 이름
        `,
                [uploadedIds]
            );

            return NextResponse.json({ success: true, toDelete: res.rows, count: res.rows.length });
        }

        // 2) 삭제 실행: "00 시작"만 삭제 (그 외는 절대 삭제 안 됨)
        const deleteIds = deleteIdsRaw.map((x) => (x ?? '').trim()).filter((x) => x && startsWith00(x));

        if (deleteIds.length === 0) {
            return NextResponse.json(
                { success: false, message: '삭제할 "00 시작" 고유번호가 없습니다.' },
                { status: 400 }
            );
        }

        await client.query('BEGIN');
        const delRes = await client.query(
            `
      DELETE FROM members
      WHERE 고유번호 LIKE '00%'
        AND 고유번호 = ANY($1)
      `,
            [deleteIds]
        );
        await client.query('COMMIT');

        return NextResponse.json({ success: true, deleted: delRes.rowCount ?? 0 });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error(err);
        return NextResponse.json({ success: false, message: err.message ?? '서버 오류' }, { status: 500 });
    } finally {
        client.release();
    }
}
