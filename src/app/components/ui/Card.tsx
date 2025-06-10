// src/app/ui/Card.tsx
import React, { ReactNode } from 'react';

export function Card({ children }: { children: ReactNode }) {
    return <div className="border rounded-md shadow p-4 bg-white">{children}</div>;
}

export function CardContent({ children }: { children: ReactNode }) {
    return <div>{children}</div>;
}
