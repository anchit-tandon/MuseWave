


import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
// FIX: Changed import path to point to .tsx file.
import { cn } from '../lib/utils';
import { useAuth } from '../src/contexts/AuthContext';

// Icons
const MusicIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
);
const LayoutDashboardIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
);
const Share2Icon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
);
const BookTextIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M8 7h6"/><path d="M8 11h8"/></svg>
);
const MenuIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
);
const UserCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/></svg>
);


const navItems = [
  { href: '/', icon: MusicIcon, label: 'Create New Music' },
  { href: '/dashboard', icon: LayoutDashboardIcon, label: 'Dashboard' },
  { href: '/n8n-workflow', icon: Share2Icon, label: 'n8n Workflow' },
  { href: '/replication-prompt', icon: BookTextIcon, label: 'Replication Prompt' },
];

function MainSidebar() {
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { logout } = useAuth();
    const displayName = 'MuseWave Owner';

    const navLinkClasses = "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-foreground";
    const activeNavLinkClasses = "bg-secondary text-foreground";

    const NavContent = () => (
        <>
            <div className="flex h-16 items-center border-b border-border px-6">
                <NavLink className="flex items-center gap-2 font-semibold" to="/">
                    <MusicIcon className="h-6 w-6 text-primary" />
                    <span className="">MuseForge Pro</span>
                </NavLink>
            </div>
            <div className="flex-1 overflow-auto py-2">
                <nav className="grid items-start px-4 text-sm font-medium">
                {navItems.map(item => (
                    <NavLink
                        key={item.href}
                        to={item.href}
                        end={item.href === '/'}
                        className={({ isActive }) => cn(navLinkClasses, isActive ? activeNavLinkClasses : '')}
                        onClick={() => setMobileMenuOpen(false)}
                    >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                    </NavLink>
                ))}
                </nav>
            </div>
            <div className="mt-auto p-4 border-t border-border space-y-4">
                 <div className="flex items-center gap-3">
                    <UserCircleIcon className="h-10 w-10 text-muted-foreground" />
                    <div>
                        <p className="font-semibold text-foreground">{displayName}</p>
                        <p className="text-xs text-muted-foreground">Product Manager</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={logout}
                    className="w-full rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 px-3 py-2 text-sm font-semibold transition-colors"
                >
                    Logout
                </button>
                <p className="text-xs text-muted-foreground text-center">
                    © 2025 MuseForge Pro. Powered by Google AI.
                </p>
            </div>
        </>
    );

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden border-r border-border bg-background md:block w-64">
                <div className="flex h-full max-h-screen flex-col">
                    <NavContent />
                </div>
            </aside>

            {/* Mobile Header and Menu */}
            <div className="md:hidden flex flex-col w-full">
                <header className="flex h-14 items-center gap-4 border-b border-border bg-muted/40 px-6 sticky top-0 z-50 backdrop-blur">
                    <NavLink className="flex items-center gap-2 font-semibold" to="/">
                        <MusicIcon className="h-6 w-6 text-primary" />
                        <span className="">MuseForge Pro</span>
                    </NavLink>
                    <button
                        className="ml-auto rounded-full p-2"
                        onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        <MenuIcon className="h-6 w-6" />
                        <span className="sr-only">Toggle navigation menu</span>
                    </button>
                </header>
                {isMobileMenuOpen && (
                    <div className="absolute top-14 left-0 w-full bg-background z-40 border-b border-border">
                         <div className="flex h-full max-h-[calc(100vh-3.5rem)] flex-col">
                            <NavContent />
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

export default MainSidebar;
