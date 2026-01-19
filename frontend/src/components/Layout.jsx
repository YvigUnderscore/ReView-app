import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useBranding } from '../context/BrandingContext';
import Sidebar from './Sidebar';
import Header from './Header';
import { useMobileDetection } from './MobileGuard';

import GlobalAnnouncement from './GlobalAnnouncement';

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [mobileSidebarDocked, setMobileSidebarDocked] = useState(false);
  const location = useLocation();

  const { isMobile, isLandscape } = useMobileDetection();
  const { refreshConfig } = useBranding();

  // Refresh config on mount to ensure we have latest announcement
  useEffect(() => {
    refreshConfig();
  }, []);

  // Hide header on mobile landscape ONLY if on a review page (Project View)
  // Dashboard and other pages should still show header for navigation
  const isProjectView = location.pathname.startsWith('/project/') || location.pathname.includes('/project/');
  const shouldHideHeader = isMobile && isLandscape && isProjectView;

  // When in mobile landscape and docket mode is active, the sidebar is not an overlay
  const isOverlay = isMobile && !mobileSidebarDocked;

  return (
    <div className="flex h-[100dvh] bg-background text-foreground overflow-hidden relative">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isMobile={isMobile}
        isDocked={false}
      />

      {/* Mobile Backdrop - Only show if it is an overlay */}
      {isSidebarOpen && isOverlay && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <GlobalAnnouncement />
        {!shouldHideHeader && <Header onMenuClick={isMobile ? null : () => setIsSidebarOpen(true)} />}
        <main className={`flex-1 overflow-auto relative ${isMobile ? 'pb-[60px]' : ''}`}>
          <Outlet context={{ setMobileSidebarDocked, mobileSidebarDocked }} />
        </main>
      </div>
    </div>
  );
};

export default Layout;

