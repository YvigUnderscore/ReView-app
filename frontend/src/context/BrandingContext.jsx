import React, { createContext, useContext, useEffect, useState } from 'react';

const BrandingContext = createContext();

export const useBranding = () => useContext(BrandingContext);

export const BrandingProvider = ({ children }) => {
    const [title, setTitle] = useState('ReView');
    const [iconUrl, setIconUrl] = useState('/vite.svg');
    const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');

    const [config, setConfig] = useState(null);

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/system/config');
            if (res.ok) {
                const data = await res.json();
                setTitle(data.title);
                setIconUrl(data.iconUrl);
                if (data.dateFormat) setDateFormat(data.dateFormat);
                setConfig(data);
            }
        } catch (e) {
            console.error("Failed to load system config", e);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    useEffect(() => {
        // Update document title
        document.title = title;
    }, [title]);

    useEffect(() => {
        // Update favicon
        const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        link.href = iconUrl;
        document.getElementsByTagName('head')[0].appendChild(link);
    }, [iconUrl]);

    return (
        <BrandingContext.Provider value={{ title, iconUrl, dateFormat, config, refreshConfig: fetchConfig }}>
            {children}
        </BrandingContext.Provider>
    );
};
