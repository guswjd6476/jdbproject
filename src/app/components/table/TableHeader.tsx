import { headers } from '@/app/lib/types';

export default function TableHeader() {
    return (
        <thead>
            <tr className="bg-gray-100">
                {headers.map((header) => (
                    <th
                        key={header}
                        className="border px-4 py-2 whitespace-nowrap"
                    >
                        {header}
                    </th>
                ))}
            </tr>
        </thead>
    );
}
