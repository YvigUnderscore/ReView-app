import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import MobileBottomNav from '../components/MobileBottomNav';
import { Toaster } from 'sonner';

const MobileLayout = () => {
    const location = useLocation();

    // Pages where we might NOT want the bottom nav (e.g., full screen player, although keeping it might be nice too)
    // For now, let's keep it everywhere except maybe specific "fullscreen" modes which we can control via state later.
    const hideNav = location.pathname.includes('/review/');

    return (
        <div className="flex flex-col h-[100dvh] w-full bg-background text-foreground overflow-hidden relative transition-colors duration-300">
            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth pb-16">
                <Outlet />
            </main>

            {/* Bottom Navigation */}
            {!hideNav && (
                <div className="flex-none z-50">
                    <MobileBottomNav />
                </div>
            )}

            {/* Mobile Toaster - Adjusted position */}
            <Toaster position="top-center" toastOptions={{
                className: 'bg-zinc-900 text-white border-zinc-800',
            }} />
        </div>
    );
};

export default MobileLayout;
