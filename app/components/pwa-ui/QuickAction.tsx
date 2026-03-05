import React from 'react';

interface QuickActionProps {
  icon: string;
  label: string;
  onClick?: () => void;
  className?: string;
}

export default function QuickAction({ icon, label, onClick, className = '' }: QuickActionProps) {
  const iconConfig: { [key: string]: { symbol: string; color: string } } = {
    check: { symbol: 'C', color: 'text-blue-600' },
    book: { symbol: 'S', color: 'text-blue-600' },
    chart: { symbol: 'R', color: 'text-blue-600' },
    user: { symbol: 'P', color: 'text-blue-600' },
  };

  const config = iconConfig[icon] || { symbol: '●', color: 'text-gray-600' };

  return (
    <div
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-3 p-5 bg-white border border-gray-200 rounded-xl transition-all duration-200 hover:border-gray-300 hover:shadow-md cursor-pointer ${className}`}
    >
      <div className={`w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center font-semibold ${config.color}`}>
        {config.symbol}
      </div>
      <p className="text-sm font-medium text-gray-700 text-center">{label}</p>
    </div>
  );
}
