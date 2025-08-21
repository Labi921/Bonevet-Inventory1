import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";

import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Dashboard from "@/pages/Dashboard";
import Inventory from "@/pages/Inventory";
import Loans from "@/pages/Loans";
import Documents from "@/pages/Documents";
import Reports from "@/pages/Reports";
import Barcode from "@/pages/Barcode";
import BorrowingRequest from "@/pages/BorrowingRequest";
import Users from "@/pages/Users";
import Resources from "@/pages/Resources";
import Settings from "@/pages/Settings";
import AuditLogs from "@/pages/AuditLogs";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import CSVImport from "./components/inventory/CSVImport";
import CategoryManagement from "@/pages/CategoryManagement";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      <Route path="/">
        <Layout>
          <ProtectedRoute allowedRoles={['admin', 'super_admin', 'standard_user']}>
            <Dashboard />
          </ProtectedRoute>
        </Layout>
      </Route>
      
      {/* Inventory routes */}
      <Route path="/inventory">
        <Layout>
          <ProtectedRoute allowedRoles={['admin', 'super_admin', 'standard_user']}>
            <Inventory />
          </ProtectedRoute>
        </Layout>
      </Route>
      
      <Route path="/inventory/add">
        <Layout>
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <Inventory />
          </ProtectedRoute>
        </Layout>
      </Route>
      
      <Route path="/inventory/view/:id">
        {(params) => (
          <Layout>
            <ProtectedRoute allowedRoles={['admin', 'super_admin', 'standard_user']}>
              <Inventory />
            </ProtectedRoute>
          </Layout>
        )}
      </Route>
      
      <Route path="/inventory/edit/:id">
        {(params) => (
          <Layout>
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <Inventory />
            </ProtectedRoute>
          </Layout>
        )}
      </Route>

      <Route path="/inventory/import">
        <Layout>
          <ProtectedRoute allowedRoles={['admin', 'super_admin', 'standard_user']}>
            <CSVImport />
          </ProtectedRoute>
        </Layout>
      </Route>

      <Route path="/inventory/categories">
        <Layout>
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <CategoryManagement />
          </ProtectedRoute>
        </Layout>
      </Route>
      
      {/* Loan routes */}
      <Route path="/loans">
        <Layout>
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <Loans />
          </ProtectedRoute>
        </Layout>
      </Route>
      
      <Route path="/loans/new">
        <Layout>
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <Loans />
          </ProtectedRoute>
        </Layout>
      </Route>

      <Route path="/loans/new-multi">
        <Layout>
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <Loans />
          </ProtectedRoute>
        </Layout>
      </Route>
      
      <Route path="/loans/view/:id">
        {(params) => (
          <Layout>
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <Loans />
            </ProtectedRoute>
          </Layout>
        )}
      </Route>
      
      {/* Document routes */}
      <Route path="/documents">
        <Layout>
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <Documents />
          </ProtectedRoute>
        </Layout>
      </Route>
      
      <Route path="/documents/new">
        <Layout>
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <Documents />
          </ProtectedRoute>
        </Layout>
      </Route>
      
      <Route path="/documents/view/:id">
        {(params) => (
          <Layout>
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <Documents />
            </ProtectedRoute>
          </Layout>
        )}
      </Route>
      
      {/* Reports route */}
      <Route path="/reports">
        <Layout>
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <Reports />
          </ProtectedRoute>
        </Layout>
      </Route>
      
      <Route path="/barcode">
        <Layout>
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <Barcode />
          </ProtectedRoute>
        </Layout>
      </Route>
      
      <Route path="/borrowing-request">
        <Layout>
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <BorrowingRequest />
          </ProtectedRoute>
        </Layout>
      </Route>
      
      {/* User routes - Admin and Super Admin only */}
      <Route path="/users">
        <Layout>
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <Users />
          </ProtectedRoute>
        </Layout>
      </Route>
      
      <Route path="/users/add">
        <Layout>
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <Users />
          </ProtectedRoute>
        </Layout>
      </Route>
      
      <Route path="/users/edit/:id">
        {(params) => (
          <Layout>
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <Users />
            </ProtectedRoute>
          </Layout>
        )}
      </Route>
      
      {/* Resources route - Standard Users and above */}
      <Route path="/resources">
        <Layout>
          <ProtectedRoute allowedRoles={['standard_user', 'staff_user', 'admin', 'super_admin']}>
            <Resources />
          </ProtectedRoute>
        </Layout>
      </Route>
      
      <Route path="/settings">
        <Layout>
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <Settings />
          </ProtectedRoute>
        </Layout>
      </Route>
      
      <Route path="/audit-logs">
        <Layout>
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <AuditLogs />
          </ProtectedRoute>
        </Layout>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="bonevet-ui-theme">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
