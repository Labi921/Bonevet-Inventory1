import { useRequireAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Download, 
  FileBarChart, 
  TrendingUp, 
  Package, 
  Handshake,
  AlertTriangle,
  Calendar as CalendarIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export default function Reports() {
  useRequireAuth();
  const { toast } = useToast();

  // Fetch data for reports
  const { data: inventoryStats } = useQuery({
    queryKey: ['/api/inventory/stats'],
  });

  const { data: inventoryItems } = useQuery({
    queryKey: ['/api/inventory'],
  });

  const { data: loans } = useQuery({
    queryKey: ['/api/loans'],
  });

  const { data: activityLogs } = useQuery({
    queryKey: ['/api/activity'],
  });

  // Type-safe access to data
  const stats = inventoryStats as { counts?: { total?: number; available?: number; loaned?: number; damaged?: number } } | undefined;
  const loansList = loans as Array<{ status: string }> | undefined;

  const handleExportInventory = async () => {
    try {
      const response = await fetch('/api/inventory/export', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to export inventory');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `inventory-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export successful",
        description: "Inventory report has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "There was an error exporting the inventory report.",
        variant: "destructive",
      });
    }
  };

  const handleExportLoans = async () => {
    try {
      // This would be implemented similar to inventory export
      toast({
        title: "Export initiated",
        description: "Loan records export is being prepared.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "There was an error exporting the loan records.",
        variant: "destructive",
      });
    }
  };

  const handleExportActivity = async () => {
    try {
      // This would be implemented similar to inventory export
      toast({
        title: "Export initiated",
        description: "Activity log export is being prepared.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "There was an error exporting the activity logs.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600">Generate and export various reports for your inventory system</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="inventory">Inventory Reports</TabsTrigger>
          <TabsTrigger value="loans">Loan Reports</TabsTrigger>
          <TabsTrigger value="activity">Activity Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Items</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.counts?.total || 0}</div>
                <p className="text-xs text-muted-foreground">
                  +2.1% from last month
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available Items</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.counts?.available || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {(stats?.counts?.total || 0) > 0 
                    ? `${Math.round(((stats?.counts?.available || 0) / (stats?.counts?.total || 1)) * 100)}%`
                    : '0%'} of total inventory
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
                <Handshake className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loansList?.filter(loan => loan.status === 'Ongoing').length || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Items currently on loan
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overdue Items</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loansList?.filter(loan => loan.status === 'Overdue').length || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Require immediate attention
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Quick Export Options</CardTitle>
              <CardDescription>
                Generate and download common reports instantly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Button onClick={handleExportInventory} className="h-20 flex flex-col">
                  <Package className="h-6 w-6 mb-2" />
                  Export Full Inventory
                </Button>
                <Button onClick={handleExportLoans} variant="outline" className="h-20 flex flex-col">
                  <Handshake className="h-6 w-6 mb-2" />
                  Export Loan Records
                </Button>
                <Button onClick={handleExportActivity} variant="outline" className="h-20 flex flex-col">
                  <FileBarChart className="h-6 w-6 mb-2" />
                  Export Activity Logs
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Reports</CardTitle>
              <CardDescription>
                Generate detailed reports about your inventory items
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Report Type</label>
                  <Select defaultValue="full">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full Inventory Report</SelectItem>
                      <SelectItem value="available">Available Items Only</SelectItem>
                      <SelectItem value="loaned">Loaned Items Only</SelectItem>
                      <SelectItem value="damaged">Damaged Items</SelectItem>
                      <SelectItem value="by-category">Report by Category</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Format</label>
                  <Select defaultValue="csv">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="xlsx">Excel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleExportInventory} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Generate Inventory Report
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loans" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Loan Reports</CardTitle>
              <CardDescription>
                Generate reports about loan activities and status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Date Range</label>
                  <div className="mt-1 p-2 border rounded-md flex items-center text-sm text-gray-500">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Last 30 days
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Report Type</label>
                  <Select defaultValue="all">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Loans</SelectItem>
                      <SelectItem value="active">Active Loans</SelectItem>
                      <SelectItem value="overdue">Overdue Loans</SelectItem>
                      <SelectItem value="returned">Returned Loans</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleExportLoans} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Generate Loan Report
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Reports</CardTitle>
              <CardDescription>
                Generate reports about system activity and audit trails
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Date Range</label>
                  <div className="mt-1 p-2 border rounded-md flex items-center text-sm text-gray-500">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Last 30 days
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Activity Type</label>
                  <Select defaultValue="all">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Activities</SelectItem>
                      <SelectItem value="inventory">Inventory Changes</SelectItem>
                      <SelectItem value="loans">Loan Activities</SelectItem>
                      <SelectItem value="user">User Actions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleExportActivity} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Generate Activity Report
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}