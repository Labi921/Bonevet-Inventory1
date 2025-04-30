import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { PlusCircle, Download, Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import LoanTable from '@/components/loans/LoanTable';
import LoanForm from '@/components/loans/LoanForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Loans() {
  const [location] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Check if we're on a sub-route
  const isNewLoan = location === '/loans/new' || location.startsWith('/loans/new?');
  const itemIdParam = new URLSearchParams(location.split('?')[1]).get('itemId');
  
  // Fetch loans
  const { data: loans, isLoading } = useQuery({
    queryKey: ['/api/loans'],
  });
  
  // Filter loans based on search term and status filter
  const filteredLoans = loans ? loans.filter((loan: any) => {
    // Search term filter (borrower name or itemId)
    const matchesSearch = 
      loan.borrowerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.borrowerContact?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.itemId.toString().includes(searchTerm);
    
    // Status filter
    const matchesStatus = statusFilter === 'all' || loan.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) : [];
  
  if (isNewLoan) {
    return <LoanForm preselectedItemId={itemIdParam ? parseInt(itemIdParam) : undefined} />;
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3">
        <CardTitle className="text-lg font-medium">Loan Management</CardTitle>
        <div className="mt-3 sm:mt-0 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <Button asChild>
            <a href="/loans/new">
              <PlusCircle className="h-4 w-4 mr-2" /> Process New Loan
            </a>
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" /> Export Loan Records
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0 mb-4">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Ongoing">Ongoing</SelectItem>
                <SelectItem value="Returned">Returned</SelectItem>
                <SelectItem value="Overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search loans..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <LoanTable loans={filteredLoans} isLoading={isLoading} />
      </CardContent>
    </Card>
  );
}
