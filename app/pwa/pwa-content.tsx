'use client';

import React from 'react';

export default function PWAContent() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Home Section */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Home</h2>
        <p className="text-gray-700">
          Welcome to Mentneo PWA. This is your main hub for managing Progressive Web App features. 
          You can view attendance, install the app, and access guidance all in one place.
        </p>
      </section>

      {/* Install App Section */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Install App</h2>
        <p className="text-gray-700">
          Install Mentneo as a Progressive Web App on your device for quick access. 
          You'll be able to use the app offline and add it to your home screen for easy navigation.
        </p>
      </section>

      {/* Attendance Guide Section */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Attendance Guide</h2>
        <p className="text-gray-700">
          Learn how to use the attendance features effectively. This guide will walk you through 
          tracking attendance, viewing reports, and managing attendance history.
        </p>
      </section>
    </div>
  );
}
