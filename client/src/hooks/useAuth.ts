import { useContext } from "react";
import { AuthContext } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useEffect } from "react";

export function useAuth() {
  const auth = useContext(AuthContext);
  const [location, setLocation] = useLocation();
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated && location !== '/login') {
      setLocation('/login');
    }
  }, [auth.isLoading, auth.isAuthenticated, location, setLocation]);
  
  return auth;
}

export function useRequireAuth(requiredRole?: string) {
  const auth = useAuth();
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      setLocation('/login');
    } else if (
      !auth.isLoading && 
      auth.isAuthenticated && 
      requiredRole && 
      auth.user?.role !== requiredRole
    ) {
      // Redirect to dashboard if user doesn't have required role
      setLocation('/');
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.user, requiredRole, setLocation]);
  
  return auth;
}
