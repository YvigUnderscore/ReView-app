import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const { user } = useAuth();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [isLoaded, setIsLoaded] = useState(false);

  // Sync with user preferences on load
  useEffect(() => {
      if (user && user.preferences) {
          try {
              const prefs = typeof user.preferences === 'string' ? JSON.parse(user.preferences) : user.preferences;
              if (prefs.theme && ['light', 'dark'].includes(prefs.theme)) {
                  setTheme(prefs.theme);
              }
          } catch (e) {
              console.error("Failed to parse user theme preference", e);
          }
      }
      setIsLoaded(true);
  }, [user]);

  // Apply theme to DOM and persist
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);

    // Save to backend if user is logged in and initial load is done
    if (user && isLoaded) {
        saveThemePreference(theme);
    }
  }, [theme, user, isLoaded]);

  const saveThemePreference = async (newTheme) => {
      try {
          await fetch('/api/users/me/client-preferences', {
              method: 'PATCH',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({ theme: newTheme })
          });
      } catch (e) {
          console.error("Failed to save theme preference", e);
      }
  };

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
