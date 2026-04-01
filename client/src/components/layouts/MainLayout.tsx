import React from "react";
import Sidebar from "@/components/sidebar/Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { Home, Heart, User } from "lucide-react";
import { Link, useLocation } from "wouter";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: Home, label: "Routes" },
    { href: "/saved", icon: Heart, label: "Saved" },
    { href: "/profile", icon: User, label: user?.username?.split("@")[0] || "Profile" },
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen safe-top">
      {!isMobile && <Sidebar />}

      <main className="flex-1 flex flex-col h-full overflow-hidden safe-bottom">
        {children}
      </main>

      {isMobile && (
        <nav className="bg-white border-t border-gray-200 fixed bottom-0 left-0 right-0 z-20 safe-bottom">
          <div className="flex justify-around items-center h-14">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <a className={`flex flex-col items-center ${isActive ? 'text-primary' : 'text-neutral-500'}`}>
                    <item.icon className="h-5 w-5" />
                    <span className="text-xs mt-0.5 truncate max-w-[70px]">{item.label}</span>
                  </a>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
