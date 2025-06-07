import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = ({ className = '', ...props }: InputProps) => {
    return (
        <input
            {...props}
            className={`border border-gray-300 rounded px-2 py-1 w-full ${className}`}
        />
    );
};
