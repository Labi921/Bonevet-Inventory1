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
      
      <Route path="/inventory">
        <Layout>
          <Inventory />
        </Layout>
      </Route>
      
      <Route path="/loans">
        <Layout>
          <Loans />
        </Layout>
      </Route>
      
      <Route path="/documents">
        <Layout>
          <Documents />
        </Layout>
      </Route>
      
      <Route path="/users">
        <Layout>
          <Users />
        </Layout>
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
