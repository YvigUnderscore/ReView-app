import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(null); // Initialize as null (unknown)
  const [securityIssue, setSecurityIssue] = useState(null);
  const [error, setError] = useState(null); // Add error state
  const [activeTeam, setActiveTeam] = useState(null);

  // Check auth status on load
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      // 1. Check if setup is needed
      const statusRes = await fetch('/api/auth/status');
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setSetupRequired(statusData.setupRequired);
        setSecurityIssue(statusData.securityIssue || null);
      } else {
        // If status check fails, assume dev mode or offline and just show landing page
        // setError('Failed to connect to backend');
        setLoading(false);
        return;
      }

      // 2. Check if we have a valid token
      const token = localStorage.getItem('token');
      if (token) {
        const meRes = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (meRes.ok) {
          const userData = await meRes.json();
          setUser(userData);
          if (userData.teams && userData.teams.length > 0) {
              const storedTeamId = localStorage.getItem('activeTeamId');
              if (storedTeamId) {
                  const storedTeam = userData.teams.find(t => t.id === parseInt(storedTeamId));
                  if (storedTeam) {
                      setActiveTeam(storedTeam);
                  } else {
                      setActiveTeam(userData.teams[0]);
                  }
              } else {
                  setActiveTeam(userData.teams[0]);
              }
          }
        } else {
          logout();
        }
      }
    } catch (err) {
      console.error(err);
      // In dev environment or if backend down, don't block the UI with error
      // setError('Network error connecting to backend');
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    setUser(userData);
    setSetupRequired(false);
    if (userData.teams && userData.teams.length > 0) {
         setActiveTeam(userData.teams[0]);
         localStorage.setItem('activeTeamId', userData.teams[0].id);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('activeTeamId');
    setUser(null);
    setActiveTeam(null);
  };

  const switchTeam = (teamId) => {
      if (!user || !user.teams) return;
      const team = user.teams.find(t => t.id === parseInt(teamId));
      if (team) {
          setActiveTeam(team);
          localStorage.setItem('activeTeamId', team.id);
      }
  };

  return (
    <AuthContext.Provider value={{ user, loading, setupRequired, securityIssue, error, login, logout, checkStatus, setUser, activeTeam, switchTeam }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
