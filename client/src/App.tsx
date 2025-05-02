import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./contexts/AuthContext";

import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Inventory from "@/pages/Inventory";
import Loans from "@/pages/Loans";
import Documents from "@/pages/Documents";
import Users from "@/pages/Users";
import Settings from "@/pages/Settings";
import AuditLogs from "@/pages/AuditLogs";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      <Route path="/">
        <Layout>
          <Dashboard />
        </Layout>
      </Route>
      
      {/* Inventory routes */}
      <Route path="/inventory">
        <Layout>
          <Inventory />
        </Layout>
      </Route>
      
      <Route path="/inventory/add">
        <Layout>
          <Inventory />
        </Layout>
      </Route>
      
      <Route path="/inventory/view/:id">
        {(params) => (
          <Layout>
            <Inventory />
          </Layout>
        )}
      </Route>
      
      <Route path="/inventory/edit/:id">
        {(params) => (
          <Layout>
            <Inventory />
          </Layout>
        )}
      </Route>
      
      {/* Loan routes */}
      <Route path="/loans">
        <Layout>
          <Loans />
        </Layout>
      </Route>
      
      <Route path="/loans/new">
        <Layout>
          <Loans />
        </Layout>
      </Route>
      
      <Route path="/loans/view/:id">
        {(params) => (
          <Layout>
            <Loans />
          </Layout>
        )}
      </Route>
      
      {/* Document routes */}
      <Route path="/documents">
        <Layout>
          <Documents />
        </Layout>
      </Route>
      
      <Route path="/documents/new">
        <Layout>
          <Documents />
        </Layout>
      </Route>
      
      <Route path="/documents/view/:id">
        {(params) => (
          <Layout>
            <Documents />
          </Layout>
        )}
      </Route>
      
      {/* User routes */}
      <Route path="/users">
        <Layout>
          <Users />
        </Layout>
      </Route>
      
      <Route path="/users/add">
        <Layout>
          <Users />
        </Layout>
      </Route>
      
      <Route path="/users/edit/:id">
        {(params) => (
          <Layout>
            <Users />
          </Layout>
        )}
      </Route>
      
      <Route path="/settings">
        <Layout>
          <Settings />
        </Layout>
      </Route>
      
      <Route path="/audit-logs">
        <Layout>
          <AuditLogs />
        </Layout>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
