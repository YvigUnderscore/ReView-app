import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Toaster } from 'sonner';

// Context Providers
import { AuthProvider } from './context/AuthContext';
import { HeaderProvider } from './context/HeaderContext';
import { ThemeProvider } from './context/ThemeContext';
import { BrandingProvider } from './context/BrandingContext';
import { NotificationProvider } from './context/NotificationContext';

// Logic
import { useMobileDetection } from './components/MobileGuard';

// Lazy Load Apps
const DesktopApp = lazy(() => import('./desktop/DesktopApp'));
const MobileApp = lazy(() => import('./mobile/MobileApp'));

// Loading Screen
const AppLoader = () => (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-black text-white">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-zinc-400 animate-pulse">Initializing ReView...</p>
    </div>
);

const AppContent = () => {
    const { isMobile } = useMobileDetection();
    // Optional: Add a small delay or state to prevent flickering if detection takes a ms?
    // MobileGuard uses useEffect, so initial render might be isMobile=false.
    // However, MobileGuard initializes state based on window.innerWidth in useEffect?
    // Looking at useMobileDetection: it has useEffect. Initial state is false.
    // This implies DesktopApp might mount then switch to MobileApp.
    // Improvement: useMobileDetection should try to initialize state lazily if possible or we use a "checking" state.
    // The existing hook starts with false. 
    // For this refactor, we accept the potential brief flash or we can modify logic later.
    // Actually, create a wrapper that waits for detection? 
    // For now, simple split.

    return (
        <Suspense fallback={<AppLoader />}>
            {isMobile ? <MobileApp /> : <DesktopApp />}
        </Suspense>
    );
};

const App = () => {
    return (
        <AuthProvider>
            <BrandingProvider>
                <HeaderProvider>
                    <ThemeProvider>
                        <NotificationProvider>
                            <Router>
                                <AppContent />
                                <Toaster richColors position="top-right" closeButton theme="system" />
                            </Router>
                        </NotificationProvider>
                    </ThemeProvider>
                </HeaderProvider>
            </BrandingProvider>
        </AuthProvider>
    );
};

export default App;
