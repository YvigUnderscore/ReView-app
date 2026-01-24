import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export const useProjects = (teamId = null) => {
    const [teams, setTeams] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { user } = useAuth();

    const fetchTeams = useCallback(async () => {
        try {
            const res = await fetch('/api/teams', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            if (!res.ok) throw new Error('Failed to fetch teams');
            const data = await res.json();
            setTeams(data);
            return data;
        } catch (err) {
            console.error(err);
            setError(err.message);
            return [];
        }
    }, []);

    const fetchProjects = useCallback(async () => {
        try {
            const res = await fetch('/api/projects', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            if (!res.ok) throw new Error('Failed to fetch projects');
            const data = await res.json();
            setProjects(data);
            return data;
        } catch (err) {
            console.error(err);
            setError(err.message);
            return [];
        }
    }, []);

    const refresh = useCallback(async () => {
        setLoading(true);
        await Promise.all([fetchTeams(), fetchProjects()]);
        setLoading(false);
    }, [fetchTeams, fetchProjects]);

    useEffect(() => {
        if (user) {
            refresh();
        }
    }, [user, refresh]);

    // Derived state
    const filteredProjects = teamId
        ? projects.filter(p => p.teamId === parseInt(teamId))
        : projects;

    return {
        teams,
        projects,
        filteredProjects,
        loading,
        error,
        refresh
    };
};
