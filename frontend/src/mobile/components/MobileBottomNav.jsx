import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Folder, User, Activity } from 'lucide-react';

const MobileBottomNav = () => {
    const navItems = [
        { path: '/dashboard', label: 'Home', icon: Home },
        { path: '/projects', label: 'Projects', icon: Folder },
        { path: '/activity', label: 'Activity', icon: Activity },
        { path: '/settings', label: 'Profile', icon: User },
    ];

    return (
        <nav className="bg-zinc-900/90 backdrop-blur-lg border-t border-white/10 pb-safe-area-bottom pt-2 px-6 shadow-2xl">
            <ul className="flex justify-between items-center h-16">
                {navItems.map(({ path, label, icon: Icon }) => (
                    <li key={path} className="flex-1">
                        <NavLink to={path} className="w-full h-full">
                            {({ isActive }) => (
                                <div className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 active:scale-95 group 
                                    ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <div className="p-1 rounded-full group-hover:bg-accent/10 transition-colors">
                                        <Icon size={26} strokeWidth={isActive ? 2.5 : 2} />
                                    </div>
                                    <span className="text-[10px] font-medium">{label}</span>
                                </div>
                            )}
                        </NavLink>
                    </li>
                ))}
            </ul>
        </nav>
    );
};

export default MobileBottomNav;
