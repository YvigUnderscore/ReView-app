import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

// Layouts
import MobileLayout from './layouts/MobileLayout';

// Pages
import MobileLogin from './pages/MobileLogin';
import MobileDashboard from './pages/MobileDashboard';
import MobileProjects from './pages/MobileProjects';
import MobileActivity from './pages/MobileActivity';
import MobileProfile from './pages/MobileProfile';
import MobileEditProfile from './pages/MobileEditProfile';
import MobilePreferences from './pages/MobilePreferences';
import MobilePrivacy from './pages/MobilePrivacy';
import MobileProjectView from './pages/MobileProjectView';

const MobileApp = () => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) return <div className="h-screen w-full bg-black flex items-center justify-center">Loading...</div>;

    // Public Routes
    if (!user) {
        return (
            <Routes>
                <Route path="/login" element={<MobileLogin />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        );
    }

    // Protected Routes
    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
                {/* Routes WITHOUT Bottom Nav (Fullscreen) */}
                <Route path="/project/:id" element={<MobileProjectView />} />
                <Route path="/:teamSlug/:projectSlug/:versionName?" element={<MobileProjectView />} />

                {/* Routes WITH Bottom Nav */}
                <Route element={<MobileLayout />}>
                    <Route path="/dashboard" element={<MobileDashboard />} />
                    <Route path="/projects" element={<MobileProjects />} />
                    <Route path="/activity" element={<MobileActivity />} />
                    <Route path="/settings" element={<MobileProfile />} />

                    {/* Settings Sub-pages (With Layout? Or Fullscreen? Generally settings are deeper, so maybe hide nav or keep it) 
                        User requested "same tints as desktop", desktop usually has modals or separate area. 
                        Mobile pattern usually full screen for these. 
                        Let's keep them INSIDE layout but maybe hideNav based on route if we want to mimic "modal" feel 
                        OR just let them render in the outlet.
                    */}
                    <Route path="/settings/edit" element={<MobileEditProfile />} />
                    <Route path="/settings/preferences" element={<MobilePreferences />} />
                    <Route path="/settings/privacy" element={<MobilePrivacy />} />

                    {/* Redirect root to dashboard */}
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Route>

                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </AnimatePresence>
    );
};

export default MobileApp;
