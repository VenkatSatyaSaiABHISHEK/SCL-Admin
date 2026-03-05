import React from 'react';
import Card from './Card';

interface AnnouncementCardProps {
  title?: string;
  message: string;
  icon?: React.ReactNode;
}

export default function AnnouncementCard({
  title = 'Latest Announcement',
  message,
  icon = '●',
}: AnnouncementCardProps) {
  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
      <div className="flex gap-4">
        <div className={`w-1 rounded-full flex-shrink-0 bg-blue-600`}></div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1 text-sm">{title}</h3>
          <p className="text-gray-700 text-sm leading-relaxed">{message}</p>
        </div>
      </div>
    </Card>
  );
}
