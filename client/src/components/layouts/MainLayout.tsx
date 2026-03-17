import React from "react";
import Sidebar from "@/components/sidebar/Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Home, Clock, User, Settings } from "lucide-react";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const isMobile = useIsMobile();
  
  return (
    <div className="flex flex-col md:flex-row h-screen">
      {/* Sidebar for desktop */}
      {!isMobile && <Sidebar />}

      {/* Main content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {children}
      </main>

      {/* Mobile bottom navigation */}
      {isMobile && (
        <nav className="bg-white border-t border-gray-200 fixed bottom-0 left-0 right-0 z-20">
          <div className="flex justify-around items-center h-16">
            <a href="#" className="flex flex-col items-center text-primary">
              <Home className="h-5 w-5" />
              <span className="text-xs mt-1">Routes</span>
            </a>
            <a href="#" className="flex flex-col items-center text-neutral-700">
              <Clock className="h-5 w-5" />
              <span className="text-xs mt-1">History</span>
            </a>
            <a href="#" className="flex flex-col items-center text-neutral-700">
              <User className="h-5 w-5" />
              <span className="text-xs mt-1">Profile</span>
            </a>
            <a href="#" className="flex flex-col items-center text-neutral-700">
              <Settings className="h-5 w-5" />
              <span className="text-xs mt-1">Settings</span>
            </a>
          </div>
        </nav>
      )}
    </div>
  );
}
