import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

// Components & Context (Relative paths adjusted)
import Layout from '../components/Layout';
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

// Desktop Specific Pages
import ProjectViewDesktop from './pages/ProjectViewDesktop';

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

const DesktopApp = () => {
    const { user, setupRequired, loading, error, securityIssue } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="h-screen w-full flex items-center justify-center bg-black text-white">Loading...</div>;
    }

    if (error) {
        return (
            <div className="h-screen w-full flex items-center justify-center flex-col bg-black text-white">
                <div className="text-red-500 font-bold mb-2">Error connecting to server</div>
                <div className="text-zinc-400">{error}</div>
                <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded">Retry</button>
            </div>
        );
    }

    if (setupRequired) {
        return (
            <>
                {securityIssue && (
                    <div className="bg-red-600 text-white text-center py-2 font-bold px-4 z-50 relative">
                        {securityIssue}
                    </div>
                )}
                <Routes>
                    <Route path="/setup" element={<Setup />} />
                    <Route path="/team/settings" element={<TeamSettings />} />
                    <Route path="*" element={<Navigate to="/setup" replace />} />
                </Routes>
            </>
        );
    }

    return (
        <>
            {securityIssue && (
                <div className="bg-red-600 text-white text-center py-2 font-bold px-4 z-50 relative">
                    {securityIssue}
                </div>
            )}
            <AnimatePresence>
                <Routes location={location} key={location.pathname}>
                    {/* Public Routes */}
                    <Route path="/" element={
                        <PageTransition>
                            {user ? <Navigate to="/dashboard" replace /> : <LandingPage />}
                        </PageTransition>
                    } />
                    <Route path="/login" element={
                        <PageTransition>
                            {user ? <Navigate to="/dashboard" replace /> : <Login />}
                        </PageTransition>
                    } />
                    <Route path="/register" element={
                        <PageTransition>
                            {user ? <Navigate to="/dashboard" replace /> : <Register />}
                        </PageTransition>
                    } />
                    <Route path="/forgot-password" element={
                        <PageTransition>
                            {user ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />}
                        </PageTransition>
                    } />
                    <Route path="/reset-password" element={
                        <PageTransition>
                            {user ? <Navigate to="/dashboard" replace /> : <ResetPasswordPage />}
                        </PageTransition>
                    } />
                    <Route path="/review/:token" element={
                        <PageTransition>
                            <ClientReview />
                        </PageTransition>
                    } />
                    <Route path="/guide" element={
                        <PageTransition>
                            <GuidePage />
                        </PageTransition>
                    } />
                    <Route path="/latest-update" element={
                        <PageTransition>
                            <LatestUpdatePage />
                        </PageTransition>
                    } />

                    {/* Fallback for setup */}
                    <Route path="/setup" element={<Navigate to="/" replace />} />

                    {/* Protected Routes */}
                    <Route element={<PrivateRoute />}>
                        <Route element={<Layout />}>
                            <Route path="/dashboard" element={
                                <PageTransition>
                                    <RecentActivity />
                                </PageTransition>
                            } />
                            <Route path="/projects" element={
                                <PageTransition>
                                    <ProjectLibrary />
                                </PageTransition>
                            } />

                            {/* Project View (Desktop) */}
                            <Route path="/project/:id" element={
                                <PageTransition>
                                    <ProjectViewDesktop />
                                </PageTransition>
                            } />
                            <Route path="/:teamSlug/:projectSlug/:versionName?" element={
                                <PageTransition>
                                    <ProjectViewDesktop />
                                </PageTransition>
                            } />

                            <Route path="/project/:id/comments-popup" element={<CommentsPopup />} />
                            <Route path="/admin" element={
                                <PageTransition>
                                    <AdminDashboard />
                                </PageTransition>
                            } />

                            <Route path="/team/roles" element={
                                <PageTransition>
                                    <TeamRoles />
                                </PageTransition>
                            } />
                            <Route path="/team/settings" element={
                                <PageTransition>
                                    <TeamSettings />
                                </PageTransition>
                            } />
                            <Route path="/team" element={
                                <PageTransition>
                                    <TeamDashboard />
                                </PageTransition>
                            } />
                            <Route path="/:teamSlug" element={
                                <PageTransition>
                                    <TeamDashboard />
                                </PageTransition>
                            } />

                            <Route path="/trash" element={
                                <PageTransition>
                                    <Trash />
                                </PageTransition>
                            } />
                            <Route path="/settings" element={
                                <PageTransition>
                                    <SettingsPage />
                                </PageTransition>
                            } />
                        </Route>
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AnimatePresence>
        </>
    );
};

export default DesktopApp;
