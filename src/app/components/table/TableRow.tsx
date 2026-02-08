'use client';

import React from 'react';
import { Input as AntInput } from 'antd';
import { STEPNAME, Student } from '@/app/lib/types';

export interface TableRowProps {
    index: number;
    row: Student;
    onChange: (index: number, field: keyof Student, value: string) => void;
    onDelete: (index: number) => void;
    selectStages: string[];
    errors?: string[];
}

// 1. React.memo로 감싸서 props가 변하지 않으면 리렌더링을 건너뜁니다.
const TableRow = React.memo(
    function TableRow({ row, index, onChange, onDelete }: TableRowProps) {
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
            '도구',
            'target',
        ];

        const isInvalidStage = row.단계 && !STEPNAME.includes(row.단계.trim().toUpperCase());

        return (
            <tr className="hover:bg-gray-50 transition-colors">
                {/* 번호 열 */}
                <td className="border p-1 text-center text-sm font-medium bg-gray-50 w-10">{index + 1}</td>

                {/* 입력 필드 */}
                {editableFields.map((field) => (
                    <td
                        key={field}
                        className="border p-0.5"
                    >
                        <AntInput
                            className={`text-sm border-none focus:ring-1 ${
                                field === '단계' && isInvalidStage ? 'bg-red-50 text-red-600' : ''
                            }`}
                            variant="borderless" // 테두리를 없애서 엑셀 같은 느낌을 줍니다
                            value={(row[field] as string) || ''}
                            onChange={(e) => onChange(index, field, e.target.value)}
                            placeholder={field === '단계' ? '발,찾,합' : ''}
                        />
                    </td>
                ))}

                {/* 삭제 버튼 */}
                <td className="border p-1 text-center w-14">
                    <button
                        onClick={() => onDelete(index)}
                        className="px-2 py-1 text-xs text-red-400 border border-red-100 rounded hover:bg-red-500 hover:text-white transition-colors"
                    >
                        삭제
                    </button>
                </td>
            </tr>
        );
    },
    (prevProps, nextProps) => {
        return prevProps.row === nextProps.row && prevProps.index === nextProps.index;
    }
);

export default TableRow;
