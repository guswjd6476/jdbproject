import React from 'react';

export const Input = ({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) => {
    return (
        <input
            {...props}
            className={`border border-gray-300 rounded px-2 py-1 w-full ${className}`}
        />
    );
};
