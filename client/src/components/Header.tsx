import { Bell, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';

export default function Header() {
  const { user } = useAuth();
  const [location] = useLocation();
  
  const getPageTitle = () => {
    if (location === '/') return 'Dashboard';
    if (location.startsWith('/inventory')) return 'Inventory';
    if (location.startsWith('/loans')) return 'Loans';
    if (location.startsWith('/documents')) return 'Documents';
    if (location.startsWith('/reports')) return 'Reports';
    if (location.startsWith('/users')) return 'Users';
    if (location.startsWith('/settings')) return 'Settings';
    if (location.startsWith('/audit-logs')) return 'Audit Logs';
    return 'BONEVET Inventory';
  };
  
  return (
    <header className="bg-white shadow-sm">
      <div className="flex justify-between items-center px-4 py-3">
        <div>
          <h2 className="text-lg font-medium text-gray-800">{getPageTitle()}</h2>
          <p className="text-sm text-gray-500">Welcome back, {user?.name || 'User'}</p>
        </div>
        <div className="flex items-center space-x-4">
          <button className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-full">
            <Bell className="h-5 w-5" />
          </button>
          <button className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-full">
            <Settings className="h-5 w-5" />
          </button>
          <div className="md:hidden">
            <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-white">
              <span className="text-sm font-bold">{user?.name.charAt(0) || 'U'}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
