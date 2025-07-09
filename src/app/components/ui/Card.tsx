// src/app/ui/Card.tsx
import React, { ReactNode } from 'react';

// Card: 전체 틀
export function Card({ children }: { children: ReactNode }) {
    return (
        <div className="border rounded-md shadow bg-white overflow-hidden max-h-[90vh] flex flex-col">{children}</div>
    );
}

// CardHeader: 고정 영역 (버튼 등)
export function CardHeader({ children }: { children: ReactNode }) {
    return <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex gap-2">{children}</div>;
}

// CardContent: 스크롤 가능한 영역
export function CardContent({ children }: { children: ReactNode }) {
    return <div className="overflow-auto px-4 py-2">{children}</div>;
}
