import { Input } from '../ui/Input';
import { Student } from '@/app/lib/types';

interface Props {
    row: Student;
    index: number;
    onChange: (index: number, field: keyof Student, value: string) => void;
}

export default function TableRow({ row, index, onChange }: Props) {
    return (
        <tr>
            {(Object.keys(row) as (keyof Student)[]).map((field) => (
                <td
                    key={field}
                    className="border px-2 py-1"
                >
                    <Input
                        value={row[field]}
                        onChange={(e) => onChange(index, field, e.target.value)}
                        className="text-sm"
                    />
                </td>
            ))}
        </tr>
    );
}
