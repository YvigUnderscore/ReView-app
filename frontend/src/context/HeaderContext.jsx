import React, { createContext, useState, useContext, useCallback } from 'react';

const HeaderContext = createContext();

export const HeaderProvider = ({ children }) => {
  const [headerTitle, setHeaderTitle] = useState('Home');
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Helper to set title easily
  const setTitle = useCallback((title) => {
    setHeaderTitle(title);
    setBreadcrumbs([]);
  }, []);

  // Helper to set breadcrumbs: e.g. ["Projects", "My Project", "Video.mp4"]
  const setBreadcrumbPath = useCallback((items) => {
    // Only update if changed to avoid unnecessary re-renders
    setBreadcrumbs(prev => {
      if (JSON.stringify(prev) === JSON.stringify(items)) return prev;
      return items;
    });
    if (items.length > 0) {
        setHeaderTitle(items[items.length - 1]);
    }
  }, []);

  return (
    <HeaderContext.Provider value={{ headerTitle, breadcrumbs, setTitle, setBreadcrumbPath, searchQuery, setSearchQuery }}>
      {children}
    </HeaderContext.Provider>
  );
};

export const useHeader = () => useContext(HeaderContext);
