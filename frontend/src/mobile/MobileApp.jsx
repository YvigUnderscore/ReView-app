import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

// Components & Context
import Layout from '../components/Layout'; // May need a MobileLayout later
import PrivateRoute from '../components/PrivateRoute';
import { useAuth } from '../context/AuthContext';

// Pages - Shared
import Login from '../pages/Login';
import Setup from '../pages/Setup';
import Register from '../pages/Register';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import LandingPage from '../pages/LandingPage';
import AdminDashboard from '../pages/Admin/AdminDashboard';
import TeamDashboard from '../pages/Team/TeamDashboard';
import RecentActivity from '../pages/RecentActivity';
import ProjectLibrary from '../pages/ProjectLibrary';
import Trash from '../pages/Trash';
import SettingsPage from '../pages/SettingsPage';
import GuidePage from '../pages/GuidePage';
import LatestUpdatePage from '../pages/LatestUpdatePage';
import TeamSettings from '../pages/Team/TeamSettings';
import TeamRoles from '../pages/Team/TeamRoles';
import ClientReview from '../pages/ClientReview';
import CommentsPopup from '../pages/CommentsPopup';

// Mobile Specific Pages
import ProjectViewMobile from './pages/ProjectViewMobile';

const PageTransition = ({ children }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="w-full h-full"
        >
            {children}
        </motion.div>
    );
};

const MobileApp = () => {
    const { user, setupRequired, loading, error, securityIssue } = useAuth();
    const location = useLocation();

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    if (setupRequired) {
        return (
            <Routes>
                <Route path="/setup" element={<Setup />} />
                <Route path="*" element={<Navigate to="/setup" replace />} />
            </Routes>
        );
    }

    return (
        <AnimatePresence>
            <Routes location={location} key={location.pathname}>
                {/* Public Routes - Shared */}
                <Route path="/" element={<PageTransition>{user ? <Navigate to="/dashboard" replace /> : <LandingPage />}</PageTransition>} />
                <Route path="/login" element={<PageTransition>{user ? <Navigate to="/dashboard" replace /> : <Login />}</PageTransition>} />
                <Route path="/register" element={<PageTransition>{user ? <Navigate to="/dashboard" replace /> : <Register />}</PageTransition>} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/review/:token" element={<ClientReview />} />
                <Route path="/guide" element={<GuidePage />} />
                <Route path="/latest-update" element={<LatestUpdatePage />} />

                {/* Protected Routes */}
                <Route element={<PrivateRoute />}>
                    {/* Using shared Layout for now, user might want specialized MobileLayout */}
                    <Route element={<Layout />}>
                        <Route path="/dashboard" element={<RecentActivity />} />
                        <Route path="/projects" element={<ProjectLibrary />} />

                        {/* Project View (Mobile) */}
                        <Route path="/project/:id" element={<ProjectViewMobile />} />
                        <Route path="/:teamSlug/:projectSlug/:versionName?" element={<ProjectViewMobile />} />

                        <Route path="/project/:id/comments-popup" element={<CommentsPopup />} />
                        <Route path="/admin" element={<AdminDashboard />} />
                        <Route path="/team" element={<TeamDashboard />} />
                        <Route path="/team/roles" element={<TeamRoles />} />
                        <Route path="/team/settings" element={<TeamSettings />} />
                        <Route path="/:teamSlug" element={<TeamDashboard />} />
                        <Route path="/trash" element={<Trash />} />
                        <Route path="/settings" element={<SettingsPage />} />
                    </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </AnimatePresence>
    );
};

export default MobileApp;
