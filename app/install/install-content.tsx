'use client';

import { useState, useEffect } from 'react';
import { Smartphone, CheckCircle, MapPin, Award, Users, BookOpen, BarChart3, WifiOff, Download, ArrowRight, Shield, Bell } from 'lucide-react';

export default function InstallContent() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [currentScreen, setCurrentScreen] = useState(0);
  const [isWaiting, setIsWaiting] = useState(true);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      setIsWaiting(false);
    }

    // Listen for beforeinstallprompt event
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
      setIsWaiting(false);
    };
    
    window.addEventListener('beforeinstallprompt', handler);

    // Give it 2 seconds to capture the prompt
    const timeout = setTimeout(() => {
      setIsWaiting(false);
    }, 2000);

    // Auto-slide phone screens
    const interval = setInterval(() => {
      setCurrentScreen(prev => (prev + 1) % 4);
    }, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // Check if we're on iOS Safari
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      
      if (isIOS || isSafari) {
        // iOS/Safari requires manual installation
        setShowInstructions(true);
      } else {
        // On Chrome/Edge but prompt not available yet
        // Try to reload and wait for the prompt
        setShowInstructions(true);
      }
      return;
    }

    // Browser supports automatic install - trigger it!
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setCanInstall(false);
    }
    
    setDeferredPrompt(null);
  };

  const screens = [
    { 
      title: 'Home', 
      icon: BarChart3, 
      color: 'bg-indigo-500',
      content: (
        <div className="space-y-3">
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 bg-indigo-500 rounded-md flex items-center justify-center">
                <Bell className="w-3 h-3 text-white" />
              </div>
              <span className="text-xs font-bold text-gray-900">Notifications</span>
            </div>
            <div className="flex gap-2 mb-2">
              <div className="w-7 h-7 bg-green-100 rounded-full flex-shrink-0"></div>
              <div className="flex-1">
                <div className="h-2 bg-gray-200 rounded w-full mb-1"></div>
                <div className="h-2 bg-gray-100 rounded w-2/3"></div>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="w-7 h-7 bg-blue-100 rounded-full flex-shrink-0"></div>
              <div className="flex-1">
                <div className="h-2 bg-gray-200 rounded w-full mb-1"></div>
                <div className="h-2 bg-gray-100 rounded w-1/2"></div>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-3 border border-indigo-100">
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <div className="h-2 bg-indigo-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-indigo-300 rounded w-1/2"></div>
              </div>
              <div className="w-10 h-10 bg-indigo-500 rounded-full"></div>
            </div>
          </div>
        </div>
      )
    },
    { 
      title: 'Attendance', 
      icon: MapPin, 
      color: 'bg-blue-500',
      content: (
        <div className="space-y-3">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="w-20 h-20 mx-auto mb-2 bg-blue-50 rounded-2xl flex items-center justify-center">
              <MapPin className="w-10 h-10 text-blue-500" />
            </div>
            <div className="h-2 bg-gray-200 rounded w-2/3 mx-auto mb-2"></div>
            <div className="h-2 bg-gray-100 rounded w-1/2 mx-auto"></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-green-50 rounded-lg p-2 border border-green-100">
              <div className="h-2 bg-green-200 rounded w-1/2 mb-1"></div>
              <div className="h-3 bg-green-400 rounded w-1/3"></div>
            </div>
            <div className="bg-orange-50 rounded-lg p-2 border border-orange-100">
              <div className="h-2 bg-orange-200 rounded w-1/2 mb-1"></div>
              <div className="h-3 bg-orange-400 rounded w-1/3"></div>
            </div>
          </div>
        </div>
      )
    },
    { 
      title: 'Rankings', 
      icon: Award, 
      color: 'bg-purple-500',
      content: (
        <div className="space-y-2">
          <div className="bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl p-3 text-white">
            <div className="flex justify-between items-center">
              <div>
                <div className="h-2 bg-white/40 rounded w-12 mb-2"></div>
                <div className="h-3 bg-white/60 rounded w-8"></div>
              </div>
              <Award className="w-8 h-8 text-white/80" />
            </div>
          </div>
          <div className="space-y-1.5">
            {[1,2,3].map((i) => (
              <div key={i} className="bg-white rounded-lg p-2 shadow-sm border border-gray-100 flex items-center gap-2">
                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-[8px] font-bold text-purple-600">
                  {i}
                </div>
                <div className="flex-1">
                  <div className="h-2 bg-gray-200 rounded w-3/4 mb-1"></div>
                  <div className="h-1.5 bg-gray-100 rounded w-1/2"></div>
                </div>
                <div className="h-2 bg-purple-200 rounded w-8"></div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    { 
      title: 'Syllabus', 
      icon: BookOpen, 
      color: 'bg-green-500',
      content: (
        <div className="space-y-2">
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-green-600" />
              <div className="h-2 bg-gray-200 rounded w-1/3"></div>
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="w-1 h-8 bg-green-500 rounded"></div>
                <div className="flex-1">
                  <div className="h-2 bg-gray-200 rounded w-2/3 mb-1.5"></div>
                  <div className="h-1.5 bg-gray-100 rounded w-1/2"></div>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="w-1 h-8 bg-blue-400 rounded"></div>
                <div className="flex-1">
                  <div className="h-2 bg-gray-200 rounded w-2/3 mb-1.5"></div>
                  <div className="h-1.5 bg-gray-100 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 bg-green-50 rounded-lg p-2 border border-green-100">
              <div className="h-1.5 bg-green-200 rounded w-2/3 mb-1"></div>
              <div className="h-2 bg-green-300 rounded w-1/2"></div>
            </div>
            <div className="flex-1 bg-blue-50 rounded-lg p-2 border border-blue-100">
              <div className="h-1.5 bg-blue-200 rounded w-2/3 mb-1"></div>
              <div className="h-2 bg-blue-300 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      )
    }
  ];

  const features = [
    {
      icon: MapPin,
      title: 'Smart Attendance',
      description: 'QR code scanning & location tracking',
      color: 'bg-blue-50 text-blue-600'
    },
    {
      icon: Award,
      title: 'Live Rankings',
      description: 'Track your rank and compete',
      color: 'bg-purple-50 text-purple-600'
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Work with your team members',
      color: 'bg-green-50 text-green-600'
    },
    {
      icon: BarChart3,
      title: 'Progress Tracking',
      description: 'Detailed analytics dashboard',
      color: 'bg-orange-50 text-orange-600'
    },
    {
      icon: BookOpen,
      title: 'Course Syllabus',
      description: 'Access study materials',
      color: 'bg-indigo-50 text-indigo-600'
    },
    {
      icon: WifiOff,
      title: 'Offline Support',
      description: 'Works without internet',
      color: 'bg-teal-50 text-teal-600'
    }
  ];

  const CurrentIcon = screens[currentScreen].icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white">
      {/* Small Floating Install Button - Top Right */}
      {!isInstalled && (
        <button
          onClick={handleInstall}
          className="fixed top-6 right-6 z-50 w-14 h-14 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-full shadow-2xl transition-all transform hover:scale-110 flex items-center justify-center group"
          title={canInstall ? "Click to install app" : "View install instructions"}
        >
          <Download className="w-6 h-6" />
          <span className="absolute right-16 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-sm font-medium px-3 py-2 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {canInstall ? "Install App" : "Install Instructions"}
          </span>
        </button>
      )}

      {/* Install Instructions Modal */}
      {showInstructions && !isInstalled && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowInstructions(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              How to Install
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              {canInstall 
                ? "If automatic install didn't work, use your browser menu:" 
                : "Use your browser's menu to install the app:"}
            </p>
            <div className="space-y-4 text-sm text-blue-800">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                <p className="font-semibold mb-2 text-blue-900">For Chrome/Edge:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-700">
                  <li>Tap menu (<span className="font-bold">⋮</span>) at top right corner</li>
                  <li>Look for "Add to Home screen" or "Install app"</li>
                  <li>Tap "Add" or "Install" button</li>
                </ol>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                <p className="font-semibold mb-2 text-purple-900">For Safari (iOS):</p>
                <ol className="list-decimal list-inside space-y-1 text-purple-700">
                  <li>Tap Share button (<span className="font-bold">⎙</span>) at the bottom</li>
                  <li>Scroll down and tap "Add to Home Screen"</li>
                  <li>Tap "Add" to confirm</li>
                </ol>
              </div>
            </div>
            <button 
              onClick={() => setShowInstructions(false)}
              className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-6 pt-12 pb-8">
        {/* App Icon & Name */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-3xl shadow-lg mb-4 p-2">
            <img 
              src="https://i.ibb.co/YBfg1BR8/1000264552-removebg-preview-1.png" 
              alt="Smart City Lab Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Smart City Lab Students
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Your smart campus companion for attendance, rankings, team collaboration and progress tracking.
          </p>
        </div>

        {/* Installed State */}
        {isInstalled && (
          <div className="text-center mb-12 animate-fade-in">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-8 max-w-md mx-auto">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-green-900 mb-2">App Installed! 🎉</h3>
              <p className="text-green-700 mb-6">
                You can now access SCL from your home screen
              </p>
              <a
                href="/pwa/login"
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-full transition-all"
              >
                Open App
                <ArrowRight className="w-5 h-5" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Phone Mockup */}
      <div className="max-w-6xl mx-auto px-6 pb-16">
        <div className="max-w-sm mx-auto">
          <div className="relative animate-float">
            {/* iPhone Frame */}
            <div className="bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl z-10"></div>
              
              {/* Screen */}
              <div className="bg-white rounded-[2.5rem] overflow-hidden aspect-[9/19.5] relative">
                {/* Screen Content */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-white p-8 transition-all duration-700">
                  {/* Status Bar */}
                  <div className="flex justify-between items-center text-gray-600 text-xs mb-8">
                    <span className="font-medium">9:41</span>
                    <div className="flex gap-1">
                      <div className="w-1 h-3 bg-gray-400 rounded-full"></div>
                      <div className="w-1 h-3 bg-gray-400 rounded-full"></div>
                      <div className="w-1 h-3 bg-gray-300 rounded-full"></div>
                    </div>
                  </div>

                  {/* Screen Title */}
                  <div className="text-center mb-6">
                    <div className={`w-14 h-14 ${screens[currentScreen].color} rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg transition-all duration-700`}>
                      <CurrentIcon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-0.5">
                      {screens[currentScreen].title}
                    </h3>
                    <p className="text-xs text-gray-500">Smart City Lab</p>
                  </div>

                  {/* Mock Content - Real UI */}
                  <div className="px-2">
                    {screens[currentScreen].content}
                  </div>

                  {/* Bottom Navigation */}
                  <div className="absolute bottom-2 left-2 right-2">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 px-2 py-2">
                      <div className="flex justify-around items-center">
                        {screens.map((screen, idx) => {
                          const Icon = screen.icon;
                          const isActive = idx === currentScreen;
                          return (
                            <div key={idx} className="flex flex-col items-center gap-0.5 py-1 px-2">
                              {isActive ? (
                                <>
                                  <div className={`w-8 h-5 ${screen.color} rounded-full flex items-center justify-center`}>
                                    <Icon className="w-3 h-3 text-white" strokeWidth={2.5} />
                                  </div>
                                  <span className="text-[7px] font-bold text-indigo-600">{screen.title}</span>
                                </>
                              ) : (
                                <>
                                  <Icon className="w-4 h-4 text-gray-400" strokeWidth={2} />
                                  <span className="text-[6px] font-medium text-gray-400">{screen.title}</span>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Badges */}
            <div className="absolute -top-4 -right-4 bg-green-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
              Free
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-6 pb-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            Everything You Need
          </h2>
          <p className="text-gray-600">Powerful features for modern students</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-all hover:-translate-y-1 border border-gray-100"
              >
                <div className={`w-12 h-12 ${feature.color} rounded-xl flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-sm md:text-base">
                  {feature.title}
                </h3>
                <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* How It Works */}
      <div className="max-w-6xl mx-auto px-6 pb-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            Get Started in 3 Steps
          </h2>
          <p className="text-gray-600">Start using SCL in under a minute</p>
        </div>

        <div className="max-w-3xl mx-auto space-y-6">
          {/* Step 1 */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
              1
            </div>
            <div className="flex-1 bg-white rounded-xl p-6 shadow-md border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <Download className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-gray-900 text-lg">Install the App</h3>
              </div>
              <p className="text-gray-600 text-sm">
                Click the "Install App" button above. The app will be added to your home screen instantly.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
              2
            </div>
            <div className="flex-1 bg-white rounded-xl p-6 shadow-md border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-gray-900 text-lg">Login with Your Account</h3>
              </div>
              <p className="text-gray-600 text-sm">
                Use your student credentials to access your personalized dashboard.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-pink-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
              3
            </div>
            <div className="flex-1 bg-white rounded-xl p-6 shadow-md border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-5 h-5 text-pink-600" />
                <h3 className="font-bold text-gray-900 text-lg">Start Using Attendance & Rankings</h3>
              </div>
              <p className="text-gray-600 text-sm">
                Mark attendance, check rankings, and track your progress in real-time.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-12 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h4 className="text-xl font-bold text-gray-900 mb-2">SCL App</h4>
          <p className="text-gray-600 mb-1">© Smart City Lab Students</p>
          <p className="text-gray-500 text-sm">Built for campus collaboration</p>
        </div>
      </footer>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        .animate-fade-in-delay {
          animation: fade-in 0.6s ease-out 0.2s both;
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
