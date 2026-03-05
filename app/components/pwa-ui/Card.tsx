import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl shadow-md p-6 transition-all duration-200 ${
        onClick ? 'hover:shadow-lg cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
