// src/app/components/table/TableRow.tsx
import { Input } from '../ui/Input';
import { Student } from '@/app/lib/types';

interface TableRowProps {
    row: Student;
    index: number;
    onChange: (i: number, field: keyof Student, v: string) => void;
    onDelete?: () => void; // ✅ 추가
    errors: string[];
    selectStages: string[];
    memberCheckStatus: {
        인도자: boolean | null;
        교사: boolean | null;
    };
}

export default function TableRow({
    row,
    index,
    onChange,
    onDelete, // ✅ 구조 분해에 포함
    errors,
    selectStages,
    memberCheckStatus,
}: TableRowProps) {
    const editableFields: (keyof Student)[] = [
        '단계',
        '이름',
        '연락처',
        '생년월일',
        '인도자지역',
        '인도자팀',
        '인도자이름',
        '교사지역',
        '교사팀',
        '교사이름',
    ];

    const renderMemberCheckMessage = (type: '인도자' | '교사') => {
        if (memberCheckStatus[type] === null) {
            return <p className="text-xs text-blue-600">검사 중...</p>;
        }
        if (memberCheckStatus[type] === false) {
            return <p className="text-xs text-red-600">{type} 정보가 멤버 목록과 일치하지 않습니다.</p>;
        }
        return null;
    };

    return (
        <tr className={errors.length ? 'bg-red-50' : ''}>
            {/* 번호 열 */}
            <td className="border p-1 text-center text-sm font-medium">{index + 1}</td>

            {/* 입력 필드 */}
            {editableFields.map((field) => (
                <td
                    key={field}
                    className="border p-1"
                >
                    {field === '단계' ? (
                        <select
                            value={row.단계 || ''}
                            onChange={(e) => onChange(index, field, e.target.value)}
                            className="w-full text-sm"
                        >
                            <option value="">선택</option>
                            {selectStages.map((s) => (
                                <option
                                    key={s}
                                    value={s}
                                >
                                    {s}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <Input
                            className="text-sm"
                            value={row[field] || ''}
                            onChange={(e) => onChange(index, field, e.target.value)}
                            placeholder={field}
                        />
                    )}
                </td>
            ))}

            {/* 오류 메시지 및 멤버 체크 */}
            <td className="border p-1">
                {errors.map((e, i) => (
                    <p
                        key={i}
                        className="text-xs text-red-600"
                    >
                        {e}
                    </p>
                ))}
                {renderMemberCheckMessage('인도자')}
                {renderMemberCheckMessage('교사')}
            </td>

            {/* 삭제 버튼 */}
            <td className="border p-1 text-center">
                {onDelete && (
                    <button
                        onClick={onDelete}
                        className="px-2 py-1 text-xs text-white bg-red-500 rounded hover:bg-red-600"
                    >
                        삭제
                    </button>
                )}
            </td>
        </tr>
    );
}
