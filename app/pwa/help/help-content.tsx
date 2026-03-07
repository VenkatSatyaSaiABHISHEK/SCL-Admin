'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Send, ArrowLeft, Bot, User, Zap, AlertCircle, MapPin, RefreshCw, LogIn, BookOpen, Trophy, HelpCircle } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: 'bot' | 'user';
  timestamp: Date;
  actions?: { label: string; query: string }[];
}

// Knowledge base for the help bot
const FAQ_DATA: { keywords: string[]; answer: string; actions?: { label: string; query: string }[] }[] = [
  {
    keywords: ['login', 'sign in', 'log in', 'cant login', 'cannot login', 'password', 'forgot password', 'wrong password', 'login every time', 'keeps logging out', 'session'],
    answer: "**Login Issues:**\n\n1. **Keeps asking to login:** Make sure you have a stable internet connection. The app uses Firebase authentication with local persistence — your session should stay active.\n\n2. **Clear your browser cache** if you're stuck in a login loop: Go to browser Settings → Clear Cache → then reopen the app.\n\n3. **Wrong password:** Contact your admin/mentor to reset your password. They can do it from the admin panel.\n\n4. **\"Account not found\" error:** Your student account may not be set up yet. Ask your admin to add you to the students collection.\n\n5. **App asking to login after update:** When we push an update, old cached data gets cleared. Just log in once and you'll stay logged in.",
    actions: [
      { label: 'Go to Login', query: 'GO_LOGIN' },
      { label: 'Password issues', query: 'How do I reset my password?' }
    ]
  },
  {
    keywords: ['attendance', 'mark attendance', 'location', 'gps', 'cant mark', 'not working', 'attendance not active', 'attendance session'],
    answer: "**Attendance Help:**\n\n1. **\"Attendance Not Active\":** Your instructor needs to start an attendance session first. Wait for them to activate it during class time.\n\n2. **Location not detected:** Make sure GPS/Location is turned ON in your phone settings AND you've given location permission to your browser.\n\n3. **\"Not within campus\":** You must be physically within the campus location set by your instructor. The system checks your GPS coordinates.\n\n4. **Already marked:** If you see your attendance is already recorded for today, you don't need to mark it again.\n\n5. **Missed attendance:** Contact your instructor — they can manually mark attendance from the admin panel.",
    actions: [
      { label: 'Go to Attendance', query: 'GO_ATTENDANCE' },
      { label: 'Location issues', query: 'My location is not being detected' }
    ]
  },
  {
    keywords: ['update', 'new version', 'update button', 'no update', 'outdated', 'old version', 'app not updating'],
    answer: "**App Updates:**\n\n1. **No update button showing?** Try these steps:\n   - Close the app completely and reopen it\n   - Pull down to refresh the page\n   - Clear browser cache: Settings → Clear browsing data → Cached images and files\n\n2. **Force update:** You can manually clear the app cache:\n   - Android: Settings → Apps → Chrome → Clear Cache\n   - iPhone: Settings → Safari → Clear History and Website Data\n\n3. **After updating:** You may need to log in once after a major update — this is normal.\n\n4. **Still stuck?** Try uninstalling and reinstalling the PWA from your home screen.",
    actions: [
      { label: 'Force refresh now', query: 'FORCE_REFRESH' }
    ]
  },
  {
    keywords: ['error', 'crash', 'not loading', 'blank', 'white screen', 'application error', 'client side exception', 'something went wrong'],
    answer: "**App Errors & Crashes:**\n\n1. **\"Application error\" or blank screen:** This is usually caused by stale cached files. Fix it:\n   - Clear your browser cache\n   - Or use the \"Force Refresh\" button below\n\n2. **White/blank screen:** Your internet connection might be unstable. Check your WiFi/data.\n\n3. **Keeps crashing:** Try these in order:\n   a. Clear browser cache\n   b. Close all tabs and reopen the app\n   c. Remove the app from home screen and add it again\n   d. If nothing works, contact your admin\n\n4. **After an update:** Sometimes old cached JavaScript conflicts with new code. Clearing cache always fixes this.",
    actions: [
      { label: 'Force refresh now', query: 'FORCE_REFRESH' },
      { label: 'Clear cache help', query: 'How do I clear my browser cache?' }
    ]
  },
  {
    keywords: ['install', 'pwa', 'home screen', 'add to home', 'download app', 'app install'],
    answer: "**Install the App:**\n\n**Android (Chrome):**\n1. Open the app in Chrome browser\n2. Tap the 3-dot menu (⋮) at top right\n3. Tap \"Add to Home screen\" or \"Install app\"\n4. Tap \"Install\" to confirm\n\n**iPhone (Safari):**\n1. Open the app in Safari\n2. Tap the Share button (□↑) at the bottom\n3. Scroll down and tap \"Add to Home Screen\"\n4. Tap \"Add\" to confirm\n\n**Note:** The app works best when installed. You'll get notifications and faster loading.",
    actions: [
      { label: 'Go to Install page', query: 'GO_INSTALL' }
    ]
  },
  {
    keywords: ['rank', 'ranking', 'points', 'score', 'leaderboard', 'marks', 'grade'],
    answer: "**Rankings & Points:**\n\n1. **How points work:** Your score is calculated based on attendance marks, task completion, and participation.\n\n2. **Rank not showing?** It might take some time for your ranking to appear after your first few sessions.\n\n3. **Points seem wrong?** Rankings are updated by your admin. If you think there's an error, contact your instructor.\n\n4. **Top 10 badge:** If you're in the top 10, you'll see a special 🏆 badge on your profile and home page!",
    actions: [
      { label: 'View Rankings', query: 'GO_RANKINGS' }
    ]
  },
  {
    keywords: ['syllabus', 'class', 'schedule', 'timetable', 'study material', 'topic', 'today class'],
    answer: "**Syllabus & Schedule:**\n\n1. **Today's classes** show up on your home page if your instructor has added them to the schedule.\n\n2. **No classes showing?** Either there are no classes scheduled for today, or the schedule hasn't been updated yet.\n\n3. **Study materials:** If your instructor uploads study materials, they'll appear in the Syllabus section. Look for the 📎 attachment icon.\n\n4. **Past topics:** You can scroll through the syllabus page to see all previous and upcoming topics.",
    actions: [
      { label: 'View Syllabus', query: 'GO_SYLLABUS' }
    ]
  },
  {
    keywords: ['notification', 'alert', 'push notification', 'not getting notifications', 'enable notification'],
    answer: "**Notifications:**\n\n1. **Enable notifications:** When you first open the app, you'll see a prompt to enable notifications. Tap \"Enable Now\".\n\n2. **Not getting notifications?**\n   - Check browser notification settings\n   - Android: Settings → Apps → Chrome → Notifications → Allow\n   - Make sure the app has notification permission\n\n3. **What notifications you'll get:**\n   - Attendance session started\n   - New announcements\n   - Class schedule reminders\n   - Ranking updates",
  },
  {
    keywords: ['profile', 'name', 'email', 'account', 'my info', 'student info'],
    answer: "**Your Profile:**\n\nYou can view your profile by tapping the profile icon (👤) in the top right corner. Your profile shows:\n- Your name and email\n- Roll number\n- Attendance stats\n- Overall ranking\n\n**Need to update your info?** Contact your admin — student details are managed from the admin panel.",
    actions: [
      { label: 'View Profile', query: 'GO_PROFILE' }
    ]
  },
  {
    keywords: ['cache', 'clear cache', 'browser cache', 'storage'],
    answer: "**How to Clear Browser Cache:**\n\n**Chrome (Android):**\n1. Tap ⋮ menu → Settings → Privacy → Clear browsing data\n2. Select \"Cached images and files\"\n3. Tap \"Clear data\"\n\n**Safari (iPhone):**\n1. Settings → Safari → Clear History and Website Data\n\n**Chrome (Desktop):**\n1. Press Ctrl+Shift+Delete\n2. Select \"Cached images and files\"\n3. Click \"Clear data\"\n\nAfter clearing cache, reopen the app and log in again.",
    actions: [
      { label: 'Force refresh now', query: 'FORCE_REFRESH' }
    ]
  },
  {
    keywords: ['reset', 'reset password', 'change password', 'forgot'],
    answer: "**Password Reset:**\n\nStudents cannot reset passwords directly. Please contact your:\n- **Instructor/Mentor** — they can reset your password from the admin panel\n- **Admin** — they have full control over student accounts\n\nYour instructor will provide you with a new temporary password that you can use to log in.",
  },
  {
    keywords: ['offline', 'no internet', 'network', 'wifi', 'data', 'connection'],
    answer: "**Offline / Network Issues:**\n\n1. **App works partially offline** — pages you've visited before are cached and can be viewed offline.\n\n2. **Attendance requires internet** — GPS verification and attendance marking need an active connection.\n\n3. **Data not loading?** Check your internet connection. Firebase real-time features need a stable connection.\n\n4. **Slow loading?** The app caches data locally after first load. Subsequent loads should be faster.",
  },
  {
    keywords: ['contact', 'admin', 'mentor', 'support', 'help desk', 'report'],
    answer: "**Need More Help?**\n\nIf the bot couldn't solve your problem:\n\n1. **Contact your Instructor/Mentor** — they can help with attendance, grades, and account issues\n2. **Report a bug** — take a screenshot of the error and share it with your admin\n3. **Common fixes that solve 90% of issues:**\n   - Clear browser cache\n   - Reinstall the app\n   - Check internet connection\n   - Try a different browser",
  }
];

const QUICK_ACTIONS = [
  { label: '🔐 Login Issues', query: 'I have login problems' },
  { label: '📍 Attendance Help', query: 'Attendance is not working' },
  { label: '🔄 App Not Updating', query: 'No update button showing' },
  { label: '❌ App Error/Crash', query: 'Application error occurred' },
  { label: '📲 Install App', query: 'How to install the app?' },
  { label: '🏆 Rankings Help', query: 'How do rankings work?' },
];

function findBestAnswer(userQuery: string): { answer: string; actions?: { label: string; query: string }[] } {
  const query = userQuery.toLowerCase().trim();
  
  let bestMatch = { score: 0, index: -1 };
  
  FAQ_DATA.forEach((faq, index) => {
    let score = 0;
    faq.keywords.forEach((keyword) => {
      if (query.includes(keyword.toLowerCase())) {
        score += keyword.split(' ').length; // Multi-word matches score higher
      }
    });
    if (score > bestMatch.score) {
      bestMatch = { score, index };
    }
  });

  if (bestMatch.index >= 0) {
    return FAQ_DATA[bestMatch.index];
  }

  // Default fallback
  return {
    answer: "I'm not sure about that specific question, but here are some things I can help with:\n\n• **Login issues** — account access, passwords\n• **Attendance** — marking attendance, GPS issues\n• **App updates** — update button, cache clearing\n• **App errors** — crashes, blank screens\n• **Installation** — adding app to home screen\n• **Rankings** — points, scores, leaderboard\n• **Syllabus** — schedule, study materials\n\nTry asking about any of these topics, or use the quick action buttons below!",
    actions: [
      { label: 'Login help', query: 'I have login problems' },
      { label: 'App errors', query: 'Application error occurred' },
      { label: 'Contact admin', query: 'How do I contact admin?' }
    ]
  };
}

export default function HelpContent() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: "👋 Hi! I'm **SCL Help Bot**. I can help you with common issues like login problems, attendance, app errors, and more.\n\nWhat do you need help with?",
      sender: 'bot',
      timestamp: new Date(),
      actions: [
        { label: '🔐 Login Issues', query: 'I have login problems' },
        { label: '📍 Attendance Help', query: 'Attendance is not working' },
        { label: '❌ App Error', query: 'Application error occurred' },
      ]
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleNavigation = (query: string) => {
    switch (query) {
      case 'GO_LOGIN': router.push('/pwa/login'); break;
      case 'GO_ATTENDANCE': router.push('/pwa/attendance'); break;
      case 'GO_RANKINGS': router.push('/pwa/rankings'); break;
      case 'GO_SYLLABUS': router.push('/pwa/syllabus'); break;
      case 'GO_PROFILE': router.push('/pwa/profile'); break;
      case 'GO_INSTALL': router.push('/install'); break;
      case 'FORCE_REFRESH':
        if ('caches' in window) {
          caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name));
          });
        }
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then((regs) => {
            regs.forEach((reg) => reg.unregister());
          });
        }
        setTimeout(() => window.location.reload(), 500);
        break;
      default: return false;
    }
    return true;
  };

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    // Check for navigation actions first
    if (handleNavigation(text)) return;

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      text: text.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate typing delay for natural feel
    setTimeout(() => {
      const { answer, actions } = findBestAnswer(text);
      const botMsg: Message = {
        id: `bot_${Date.now()}`,
        text: answer,
        sender: 'bot',
        timestamp: new Date(),
        actions,
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 600 + Math.random() * 400);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Simple markdown-like rendering for bold text
  const renderText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\n)/g);
    return parts.map((part, i) => {
      if (part === '\n') return <br key={i} />;
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button 
          onClick={() => router.push('/pwa/home')}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="font-bold text-gray-900 text-sm">SCL Help Bot</h1>
          <p className="text-[10px] text-green-600 font-medium">Always online • Instant help</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-36">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${msg.sender === 'user' ? 'order-1' : 'order-1'}`}>
              {msg.sender === 'bot' && (
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border border-gray-100">
                      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                        {renderText(msg.text)}
                      </p>
                    </div>
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2 ml-1">
                        {msg.actions.map((action, idx) => (
                          <button
                            key={idx}
                            onClick={() => sendMessage(action.query)}
                            className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full hover:bg-indigo-100 transition-colors border border-indigo-200"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-[9px] text-gray-400 mt-1 ml-1">
                      {msg.timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </p>
                  </div>
                </div>
              )}
              {msg.sender === 'user' && (
                <div>
                  <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-md px-4 py-3 shadow-sm">
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                  </div>
                  <p className="text-[9px] text-gray-400 mt-1 text-right mr-1">
                    {msg.timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border border-gray-100">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />

        {/* Quick Actions (shown when no user messages yet) */}
        {messages.length <= 1 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-500 mb-3 px-1">Quick Help Topics</p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(action.query)}
                  className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-left hover:shadow-md hover:border-indigo-200 transition-all"
                >
                  <p className="text-xs font-semibold text-gray-800">{action.label}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 pb-6">
        <form onSubmit={handleSubmit} className="flex items-center gap-2 max-w-2xl mx-auto">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question..."
            className="flex-1 px-4 py-3 bg-gray-100 rounded-xl text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </form>
      </div>
    </div>
  );
}
