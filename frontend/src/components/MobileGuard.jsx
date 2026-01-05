import React, { useEffect, useState } from 'react';
import { Smartphone, RotateCw } from 'lucide-react';

export const useMobileDetection = () => {
    const [isMobile, setIsMobile] = useState(false);
    const [isLandscape, setIsLandscape] = useState(true);

    useEffect(() => {
        const checkMobile = () => {
            const userAgent = navigator.userAgent || navigator.vendor || window.opera;
            const mobileRegex = /android|ipad|iphone|ipod/i;
            // Also check screen width to avoid false positives on desktop resizing
            // Increased to 1280 to support landscape mobile devices
            const isSmallScreen = window.innerWidth <= 1280;
            setIsMobile(mobileRegex.test(userAgent) && isSmallScreen);
        };

        const checkOrientation = () => {
             // screen.orientation.type or window.orientation
             // window.orientation is deprecated but useful for iOS sometimes
             // screen.orientation is standard
             if (screen.orientation) {
                 setIsLandscape(screen.orientation.type.includes('landscape'));
             } else {
                 setIsLandscape(window.innerWidth > window.innerHeight);
             }
        };

        checkMobile();
        checkOrientation();

        window.addEventListener('resize', checkMobile);
        window.addEventListener('resize', checkOrientation);
        if (screen.orientation) {
            screen.orientation.addEventListener('change', checkOrientation);
        } else {
            window.addEventListener('orientationchange', checkOrientation);
        }

        return () => {
            window.removeEventListener('resize', checkMobile);
            window.removeEventListener('resize', checkOrientation);
            if (screen.orientation) {
                screen.orientation.removeEventListener('change', checkOrientation);
            } else {
                window.removeEventListener('orientationchange', checkOrientation);
            }
        };
    }, []);

    return { isMobile, isLandscape };
};

const MobileGuard = () => {
    // MobileGuard is now disabled to allow portrait mode
    return null;
};

export default MobileGuard;
