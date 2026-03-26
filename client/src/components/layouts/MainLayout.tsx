import React from "react";
import Sidebar from "@/components/sidebar/Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { Home, Clock, User, LogOut } from "lucide-react";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const isMobile = useIsMobile();
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-col md:flex-row h-screen pt-safe">
      {/* Sidebar for desktop */}
      {!isMobile && <Sidebar />}

      {/* Main content — add bottom padding on mobile to avoid bottom nav overlap */}
      <main className="flex-1 flex flex-col h-full overflow-hidden pb-safe">
        {children}
      </main>

      {/* Mobile bottom navigation — safe area aware */}
      {isMobile && (
        <nav className="bg-white border-t border-gray-200 fixed bottom-0 left-0 right-0 z-20 pb-safe px-safe">
          <div className="flex justify-around items-center h-14">
            <a href="/" className="flex flex-col items-center text-primary">
              <Home className="h-5 w-5" />
              <span className="text-xs mt-0.5">Routes</span>
            </a>
            <a href="#" className="flex flex-col items-center text-neutral-500">
              <Clock className="h-5 w-5" />
              <span className="text-xs mt-0.5">History</span>
            </a>
            <a href="#" className="flex flex-col items-center text-neutral-500">
              <User className="h-5 w-5" />
              <span className="text-xs mt-0.5">{user?.username?.split("@")[0] || "Profile"}</span>
            </a>
            <button
              onClick={() => logout()}
              className="flex flex-col items-center text-neutral-500"
            >
              <LogOut className="h-5 w-5" />
              <span className="text-xs mt-0.5">Logout</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
