import { useQuery } from '@tanstack/react-query';
import { Package, CheckCircle, Handshake, AlertTriangle } from 'lucide-react';
import StatsCard from '@/components/stats/StatsCard';
import CategoryDistribution from '@/components/charts/CategoryDistribution';
import RecentActivity from '@/components/tables/RecentActivity';
import RecentLoans from '@/components/tables/RecentLoans';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Dashboard() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  // Fetch inventory stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/inventory/stats'],
  });
  
  // Calculate percentages
  const totalItems = statsData?.counts?.total || 0;
  const availablePercentage = totalItems > 0 
    ? Math.round((statsData?.counts?.available || 0) / totalItems * 100) 
    : 0;
  const loanedPercentage = totalItems > 0 
    ? Math.round((statsData?.counts?.loaned || 0) / totalItems * 100) 
    : 0;
  const damagedPercentage = totalItems > 0 
    ? Math.round((statsData?.counts?.damaged || 0) / totalItems * 100) 
    : 0;
  
  // Quick action handlers
  const handleAddItem = () => navigate('/inventory/add');
  const handleGenerateDocument = () => navigate('/documents/new');
  const handleProcessLoan = () => navigate('/loans/new');
  const handleExportReport = () => {
    toast({
      title: 'Export Started',
      description: 'Your inventory report is being generated.',
    });
  };
  
  return (
    <div>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Total Items"
          value={statsLoading ? '...' : statsData?.counts?.total || 0}
          icon={<Package className="h-5 w-5" />}
          variant="primary"
          footer={
            <span className="text-xs text-green-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              3.2% from last month
            </span>
          }
        />
        
        <StatsCard
          title="Available Items"
          value={statsLoading ? '...' : statsData?.counts?.available || 0}
          icon={<CheckCircle className="h-5 w-5" />}
          variant="success"
          footer={
            <div className="text-xs">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: `${availablePercentage}%` }}></div>
              </div>
              <span className="text-gray-600">{availablePercentage}% of total inventory</span>
            </div>
          }
        />
        
        <StatsCard
          title="Items on Loan"
          value={statsLoading ? '...' : statsData?.counts?.loaned || 0}
          icon={<Handshake className="h-5 w-5" />}
          variant="warning"
          footer={
            <div className="text-xs">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-amber-600 h-2 rounded-full" style={{ width: `${loanedPercentage}%` }}></div>
              </div>
              <span className="text-gray-600">{loanedPercentage}% of total inventory</span>
            </div>
          }
        />
        
        <StatsCard
          title="Damaged Items"
          value={statsLoading ? '...' : statsData?.counts?.damaged || 0}
          icon={<AlertTriangle className="h-5 w-5" />}
          variant="destructive"
          footer={
            <div className="text-xs">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-red-600 h-2 rounded-full" style={{ width: `${damagedPercentage}%` }}></div>
              </div>
              <span className="text-gray-600">{damagedPercentage}% of total inventory</span>
            </div>
          }
        />
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Recent Inventory Activity */}
        <div className="lg:col-span-2">
          <RecentActivity />
        </div>

        {/* Quick Actions Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-md font-medium">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              className="w-full justify-center" 
              onClick={handleAddItem}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add New Item
            </Button>
            <Button 
              variant="secondary" 
              className="w-full justify-center bg-green-600 hover:bg-green-700 text-white" 
              onClick={handleGenerateDocument}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Generate New Document
            </Button>
            <Button 
              variant="secondary" 
              className="w-full justify-center bg-amber-600 hover:bg-amber-700 text-white" 
              onClick={handleProcessLoan}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
              </svg>
              Process New Loan
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-center" 
              onClick={handleExportReport}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Inventory Report
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Category Distribution & Recent Loans */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Category Distribution */}
        <div className="lg:col-span-1">
          <CategoryDistribution data={statsData?.categories || []} isLoading={statsLoading} />
        </div>

        {/* Recent Loans */}
        <div className="lg:col-span-2">
          <RecentLoans />
        </div>
      </div>
    </div>
  );
}
