import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
}

export const Button = ({ children, className = '', ...props }: ButtonProps) => {
    return (
        <button
            {...props}
            className={`bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition ${className}`}
        >
            {children}
        </button>
    );
};
