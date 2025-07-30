// src/app/components/table/TableRow.tsx
import { Input as AntInput } from 'antd';
import { Student } from '@/app/lib/types';

interface TableRowProps {
    row: Student;
    index: number;
    onChange: (i: number, field: keyof Student, v: string) => void;
    onDelete?: () => void;
    errors: string[];
    selectStages: string[];
}

export default function TableRow({ row, index, onChange, onDelete, errors, selectStages }: TableRowProps) {
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
    const allowedStages = ['발', '찾', '합', '섭', '복', '예정', '탈락'];
    const isInvalidStage = row.단계 && !allowedStages.includes(row.단계.trim().toUpperCase());

    return (
        <tr className={errors.length ? 'bg-red-50' : ''}>
            {/* 번호 열 */}
            <td className="border p-1 text-center text-sm font-medium">{index + 1}</td>

            {/* 입력 필드 */}
            {editableFields.map((field) => (
                <td key={field} className="border p-1">
                    {field === '단계' ? (
                        <AntInput
                            className={`text-sm ${isInvalidStage ? 'border-red-500 border' : ''}`}
                            value={row.단계 || ''}
                            onChange={(e) => onChange(index, field, e.target.value)}
                            placeholder="발,찾,합 등"
                        />
                    ) : (
                        <AntInput
                            className="text-sm"
                            value={row[field] || ''}
                            onChange={(e) => onChange(index, field, e.target.value)}
                            placeholder={field}
                        />
                    )}
                </td>
            ))}

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
