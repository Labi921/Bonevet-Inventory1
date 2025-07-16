import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Gauge,
  Package,
  Handshake,
  FileText,
  BarChart,
  Users,
  Settings,
  History,
  LogOut,
} from 'lucide-react';

export default function Sidebar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location] = useLocation();
  const { user, logout } = useAuth();
  
  // Close mobile menu on location change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);
  
  // Close mobile menu on larger screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const isActive = (path: string) => {
    if (path === '/' && location === '/') return true;
    if (path !== '/' && location.startsWith(path)) return true;
    return false;
  };
  
  const navItems = [
    { path: '/', label: 'Dashboard', icon: <Gauge className="w-5 h-5 mr-2" /> },
    { path: '/inventory', label: 'Inventory', icon: <Package className="w-5 h-5 mr-2" /> },
    { path: '/loans', label: 'Loans', icon: <Handshake className="w-5 h-5 mr-2" /> },
    { path: '/documents', label: 'Documents', icon: <FileText className="w-5 h-5 mr-2" /> },
    { path: '/reports', label: 'Reports', icon: <BarChart className="w-5 h-5 mr-2" /> },
  ];
  
  const adminItems = [
    { path: '/users', label: 'Users', icon: <Users className="w-5 h-5 mr-2" /> },
    { path: '/settings', label: 'Settings', icon: <Settings className="w-5 h-5 mr-2" /> },
    { path: '/audit-logs', label: 'Audit Logs', icon: <History className="w-5 h-5 mr-2" /> },
  ];
  
  return (
    <aside className="bg-primary-800 text-white w-full md:w-64 md:min-h-screen transition-all duration-300 ease-in-out">
      <div className="p-4 flex justify-between items-center md:justify-center border-b border-primary-700">
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-md bg-primary-600 flex items-center justify-center">
            <span className="font-bold">BV</span>
          </div>
          <h1 className="text-xl font-bold">BONEVET</h1>
        </div>
        <button 
          className="md:hidden text-white"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>
      
      <div className={`p-4 ${isMobileMenuOpen ? 'block' : 'hidden'} md:block`}>
        <div className="py-4">
          <p className="text-white/90 text-xs uppercase font-bold">Main Menu</p>
          <nav className="mt-2">
            {navItems.map((item) => (
              <Link 
                key={item.path} 
                href={item.path}
              >
                <a 
                  className={`block py-2.5 px-4 rounded transition duration-200 
                    ${isActive(item.path) 
                      ? 'bg-primary-700 text-white' 
                      : 'hover:bg-primary-700 text-gray-200'}`}
                >
                  <div className="flex items-center">
                    {item.icon}
                    {item.label}
                  </div>
                </a>
              </Link>
            ))}
          </nav>
        </div>
        
        {user?.role === 'admin' && (
          <div className="py-4 border-t border-primary-700">
            <p className="text-white/90 text-xs uppercase font-bold">Admin</p>
            <nav className="mt-2">
              {adminItems.map((item) => (
                <Link 
                  key={item.path} 
                  href={item.path}
                >
                  <a 
                    className={`block py-2.5 px-4 rounded transition duration-200 
                      ${isActive(item.path) 
                        ? 'bg-primary-700 text-white' 
                        : 'hover:bg-primary-700 text-gray-200'}`}
                  >
                    <div className="flex items-center">
                      {item.icon}
                      {item.label}
                    </div>
                  </a>
                </Link>
              ))}
            </nav>
          </div>
        )}
      </div>
      
      <div className={`mt-auto p-4 border-t border-primary-700 ${isMobileMenuOpen ? 'block' : 'hidden'} md:block`}>
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
            <span className="text-sm font-bold">{user?.name.charAt(0) || 'U'}</span>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-white">{user?.name || 'User'}</p>
            <p className="text-xs text-gray-300">{user?.role === 'admin' ? 'Administrator' : 'User'}</p>
          </div>
        </div>
        <Button 
          variant="secondary" 
          className="mt-4 w-full bg-primary-700 text-white hover:bg-primary-600"
          onClick={() => logout()}
        >
          <LogOut className="h-4 w-4 mr-2" /> Log Out
        </Button>
      </div>
    </aside>
  );
}
