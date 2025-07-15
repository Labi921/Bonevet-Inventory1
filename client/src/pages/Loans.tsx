import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Download, Search, Package, Users, Eye } from 'lucide-react';
import { format, isAfter, parseISO } from 'date-fns';
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
import MultiItemLoanForm from '@/components/loans/MultiItemLoanForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Loans() {
  const [location] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { toast } = useToast();
  
  // Check if we're on a sub-route
  const isNewLoan = location === '/loans/new' || location.startsWith('/loans/new?');
  const isMultiItemLoan = location === '/loans/new-multi' || location.startsWith('/loans/new-multi?');
  const itemIdParam = new URLSearchParams(location.split('?')[1]).get('itemId');
  const [returnLoanGroupId, setReturnLoanGroupId] = useState<number | null>(null);
  
  // Fetch individual loans
  const { data: loans, isLoading: isLoadingLoans } = useQuery({
    queryKey: ['/api/loans'],
  });
  
  // Fetch loan groups
  const { data: loanGroups, isLoading: isLoadingLoanGroups } = useQuery({
    queryKey: ['/api/loan-groups'],
  });
  
  // Return loan group mutation
  const returnLoanGroup = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('PUT', `/api/loan-groups/${id}/return`, {
        actualReturnDate: new Date()
      });
      return response.json();
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/loan-groups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity/recent'] });
      
      toast({
        title: 'Items Returned',
        description: 'All items in this loan group have been marked as returned and are now available.',
      });
      
      setReturnLoanGroupId(null);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to return the items. Please try again.',
        variant: 'destructive',
      });
      console.error('Error returning loan group:', error);
    },
  });
  
  // Filter individual loans based on search term and status filter
  const filteredLoans = Array.isArray(loans) ? loans.filter((loan: any) => {
    // Search term filter (borrower name or itemId)
    const matchesSearch = 
      loan.borrowerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.borrowerContact?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.itemId?.toString().includes(searchTerm);
    
    // Status filter
    const matchesStatus = statusFilter === 'all' || loan.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) : [];
  
  // Filter loan groups based on search term and status filter
  const filteredLoanGroups = Array.isArray(loanGroups) ? loanGroups.filter((group: any) => {
    // Search term filter (borrower name)
    const matchesSearch = 
      group.borrowerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.borrowerContact?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.loanGroupId?.includes(searchTerm);
    
    // Status filter
    const matchesStatus = statusFilter === 'all' || group.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) : [];
  
  if (isNewLoan) {
    return <LoanForm preselectedItemId={itemIdParam ? parseInt(itemIdParam) : undefined} />;
  }
  
  if (isMultiItemLoan) {
    return <MultiItemLoanForm preselectedItemId={itemIdParam ? parseInt(itemIdParam) : undefined} />;
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3">
        <CardTitle className="text-lg font-medium">Loan Management</CardTitle>
        <div className="mt-3 sm:mt-0 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <PlusCircle className="h-4 w-4 mr-2" /> Process New Loan
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <a href="/loans/new" className="flex items-center cursor-pointer">
                  Single Item Loan
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/loans/new-multi" className="flex items-center cursor-pointer">
                  <Package className="h-4 w-4 mr-2" />
                  Multi-Item Loan
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
        
        <Tabs defaultValue="individual" className="mt-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="individual">
              Individual Loans
            </TabsTrigger>
            <TabsTrigger value="groups">
              <Package className="h-4 w-4 mr-2" />
              Multi-Item Loans
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="individual" className="mt-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Individual Item Loans</h3>
            <LoanTable loans={filteredLoans} isLoading={isLoadingLoans} />
          </TabsContent>
          
          <TabsContent value="groups" className="mt-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              <div className="flex items-center">
                <Package className="h-4 w-4 mr-2" />
                <span>Multi-Item Loan Groups</span>
              </div>
            </h3>
            
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loan Group ID</TableHead>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Date Out</TableHead>
                    <TableHead>Expected Return</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingLoanGroups ? (
                    Array(3).fill(0).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="w-32 h-5 bg-gray-200 animate-pulse rounded"></div>
                        </TableCell>
                        <TableCell>
                          <div className="w-28 h-5 bg-gray-200 animate-pulse rounded"></div>
                        </TableCell>
                        <TableCell>
                          <div className="w-16 h-5 bg-gray-200 animate-pulse rounded"></div>
                        </TableCell>
                        <TableCell>
                          <div className="w-24 h-5 bg-gray-200 animate-pulse rounded"></div>
                        </TableCell>
                        <TableCell>
                          <div className="w-24 h-5 bg-gray-200 animate-pulse rounded"></div>
                        </TableCell>
                        <TableCell>
                          <div className="w-20 h-5 bg-gray-200 animate-pulse rounded"></div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <div className="w-20 h-8 bg-gray-200 animate-pulse rounded"></div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredLoanGroups && filteredLoanGroups.length > 0 ? (
                    filteredLoanGroups.map((group: any) => (
                      <TableRow key={group.id}>
                        <TableCell className="font-mono text-sm">
                          {group.loanGroupId}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{group.borrowerName}</p>
                            <p className="text-sm text-gray-500">({group.borrowerType})</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                            {Array.isArray(group.items) ? group.items.length : "?"} items
                          </span>
                        </TableCell>
                        <TableCell>
                          {group.loanDate ? format(new Date(group.loanDate), 'MMM dd, yyyy') : '—'}
                        </TableCell>
                        <TableCell>
                          {group.expectedReturnDate ? format(new Date(group.expectedReturnDate), 'MMM dd, yyyy') : '—'}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            group.status === 'Returned' 
                              ? 'bg-green-100 text-green-800' 
                              : group.expectedReturnDate && isAfter(new Date(), new Date(group.expectedReturnDate))
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {group.status === 'Returned' 
                              ? 'Returned' 
                              : group.expectedReturnDate && isAfter(new Date(), new Date(group.expectedReturnDate))
                              ? 'Overdue'
                              : 'Ongoing'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  View
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="max-w-4xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Multi-Item Loan Details</AlertDialogTitle>
                                  <AlertDialogDescription asChild>
                                    <div className="space-y-6">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <h4 className="font-semibold text-gray-900">Loan Group Information</h4>
                                          <p className="text-sm text-gray-600">
                                            ID: {group.loanGroupId}
                                          </p>
                                          <p className="text-sm text-gray-600">
                                            Status: <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                              group.status === 'Returned' 
                                                ? 'bg-green-100 text-green-800' 
                                                : group.expectedReturnDate && isAfter(new Date(), new Date(group.expectedReturnDate))
                                                ? 'bg-red-100 text-red-800'
                                                : 'bg-amber-100 text-amber-800'
                                            }`}>
                                              {group.status === 'Returned' 
                                                ? 'Returned' 
                                                : group.expectedReturnDate && isAfter(new Date(), new Date(group.expectedReturnDate))
                                                ? 'Overdue'
                                                : 'Ongoing'}
                                            </span>
                                          </p>
                                        </div>
                                        <div>
                                          <h4 className="font-semibold text-gray-900">Borrower Information</h4>
                                          <p className="text-sm text-gray-600">
                                            Name: {group.borrowerName}
                                          </p>
                                          <p className="text-sm text-gray-600">
                                            Type: {group.borrowerType}
                                          </p>
                                          {group.borrowerContact && (
                                            <p className="text-sm text-gray-600">
                                              Contact: {group.borrowerContact}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <h4 className="font-semibold text-gray-900">Loan Dates</h4>
                                          <p className="text-sm text-gray-600">
                                            Out: {group.loanDate ? format(new Date(group.loanDate), 'MMM dd, yyyy') : '—'}
                                          </p>
                                          <p className="text-sm text-gray-600">
                                            Expected Return: {group.expectedReturnDate ? format(new Date(group.expectedReturnDate), 'MMM dd, yyyy') : '—'}
                                          </p>
                                        </div>
                                        <div>
                                          <h4 className="font-semibold text-gray-900">Items Count</h4>
                                          <p className="text-sm text-gray-600">
                                            Total Items: {Array.isArray(group.items) ? group.items.length : "Unknown"}
                                          </p>
                                        </div>
                                      </div>
                                      
                                      {group.notes && (
                                        <div>
                                          <h4 className="font-semibold text-gray-900">Notes</h4>
                                          <p className="text-sm text-gray-600">{group.notes}</p>
                                        </div>
                                      )}
                                      
                                      <div>
                                        <h4 className="font-semibold text-gray-900 mb-2">Loaned Items</h4>
                                        <div className="border rounded-lg overflow-hidden">
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead className="w-[100px]">Item ID</TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Quantity</TableHead>
                                                <TableHead>Status</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {Array.isArray(group.items) && group.items.length > 0 ? (
                                                group.items.map((item: any, idx: number) => (
                                                  <TableRow key={idx}>
                                                    <TableCell className="font-medium">
                                                      {item.itemId || `Item #${item.id}`}
                                                    </TableCell>
                                                    <TableCell>
                                                      {item.name || 'Unknown Item'}
                                                    </TableCell>
                                                    <TableCell>
                                                      {item.quantityLoaned || 1}
                                                    </TableCell>
                                                    <TableCell>
                                                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                        item.status === 'Returned' 
                                                          ? 'bg-green-100 text-green-800' 
                                                          : 'bg-amber-100 text-amber-800'
                                                      }`}>
                                                        {item.status || 'Ongoing'}
                                                      </span>
                                                    </TableCell>
                                                  </TableRow>
                                                ))
                                              ) : (
                                                <TableRow>
                                                  <TableCell colSpan={4} className="h-24 text-center">
                                                    No items found for this loan group.
                                                  </TableCell>
                                                </TableRow>
                                              )}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      </div>
                                    </div>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Close</AlertDialogCancel>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            
                            {group.status !== 'Returned' ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-green-600 hover:text-green-700"
                                  >
                                    Return All Items
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Return All Items</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to mark all items in this loan group as returned? 
                                      This will update the inventory status for all loaned items.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => returnLoanGroup.mutate(group.id)}
                                      className="bg-green-600 hover:bg-green-700"
                                    >
                                      Return All Items
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                disabled
                              >
                                Already Returned
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        No loan groups found. Create a new multi-item loan to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
