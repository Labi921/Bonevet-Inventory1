import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { useEffect, useState } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
  redirectTo?: string;
}

export default function ProtectedRoute({ 
  children, 
  allowedRoles, 
  redirectTo = '/resources' 
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    if (!isLoading && user && !hasRedirected) {
      if (!allowedRoles.includes(user.role)) {
        // Staff users get redirected to resources
        if (user.role === 'staff_user') {
          setHasRedirected(true);
          setLocation(redirectTo);
        }
      }
    }
  }, [user, isLoading, allowedRoles, redirectTo, setLocation, hasRedirected]);

  // Show loading
  if (isLoading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  // Allow access if user has the required role
  if (user && allowedRoles.includes(user.role)) {
    return <>{children}</>;
  }

  // For staff users, show access restricted message instead of redirecting on certain pages
  if (user?.role === 'staff_user' && location !== '/resources') {
    return <div className="p-6 text-center">
      <h2 className="text-2xl font-bold text-gray-600 mb-4">Access Restricted</h2>
      <p className="text-gray-500 mb-4">You only have access to the Resources section.</p>
      <button 
        onClick={() => setLocation('/resources')}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Go to Resources
      </button>
    </div>;
  }

  return <>{children}</>;
}