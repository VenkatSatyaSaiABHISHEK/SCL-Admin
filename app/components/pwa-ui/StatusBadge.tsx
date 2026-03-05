import React from 'react';

interface StatusBadgeProps {
  status: 'active' | 'closed' | 'inactive';
  label: string;
}

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  const statusStyles = {
    active: 'bg-green-100 text-green-700 border border-green-300',
    closed: 'bg-red-100 text-red-700 border border-red-300',
    inactive: 'bg-gray-100 text-gray-700 border border-gray-300',
  };

  return (
    <div className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${statusStyles[status]}`}>
      {label}
    </div>
  );
}
