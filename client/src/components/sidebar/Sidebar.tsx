import { Home, Clock, User, Settings } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function Sidebar() {
  const [location] = useLocation();
  
  return (
    <aside className="w-64 bg-white border-r border-gray-200 p-4">
      <div className="flex items-center mb-6">
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
          <i className="fas fa-running text-white"></i>
        </div>
        <span className="ml-2 text-xl font-semibold">RunFlex</span>
      </div>
      
      <nav className="space-y-2">
        <Link href="/">
          <a className={`flex items-center p-2 rounded-lg hover:bg-neutral-100 ${location === '/' ? 'text-primary' : 'text-neutral-700'}`}>
            <Home className="w-5 h-5 mr-2" />
            <span>Routes</span>
          </a>
        </Link>
        <a href="#" className="flex items-center p-2 text-neutral-700 rounded-lg hover:bg-neutral-100">
          <Clock className="w-5 h-5 mr-2" />
          <span>History</span>
        </a>
        <a href="#" className="flex items-center p-2 text-neutral-700 rounded-lg hover:bg-neutral-100">
          <User className="w-5 h-5 mr-2" />
          <span>Profile</span>
        </a>
        <a href="#" className="flex items-center p-2 text-neutral-700 rounded-lg hover:bg-neutral-100">
          <Settings className="w-5 h-5 mr-2" />
          <span>Settings</span>
        </a>
      </nav>
      
      <div className="mt-6 border-t border-gray-200 pt-4">
        <div className="text-sm text-neutral-700 mb-2 font-medium">Your Preferences</div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500">Distance</label>
            <div className="text-sm font-medium">5-10 km</div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Scenery</label>
            <div className="text-sm font-medium">Parks, Waterfront</div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Traffic Level</label>
            <div className="text-sm font-medium">Low to Medium</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
