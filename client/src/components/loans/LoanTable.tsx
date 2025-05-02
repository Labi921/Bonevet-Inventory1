import { useLocation } from 'wouter';
import { format, isAfter, parseISO } from 'date-fns';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { useState } from 'react';
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

interface LoanTableProps {
  loans: any[];
  isLoading: boolean;
}

export default function LoanTable({ loans, isLoading }: LoanTableProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [returnLoanId, setReturnLoanId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Fetch inventory items to display names
  const { data: inventory } = useQuery({
    queryKey: ['/api/inventory'],
  });
  
  // Calculate pagination
  const totalPages = Math.ceil((loans?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLoans = loans?.slice(startIndex, startIndex + itemsPerPage) || [];
  
  // Return loan mutation
  const returnLoan = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('PUT', `/api/loans/${id}/return`, {
        actualReturnDate: new Date()
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity/recent'] });
      
      toast({
        title: 'Item Returned',
        description: 'The loan has been marked as returned and the item is now available.',
      });
      
      setReturnLoanId(null);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to return the item. Please try again.',
        variant: 'destructive',
      });
      console.error('Error returning item:', error);
    },
  });
  
  // Handle return loan
  const handleReturnLoan = (id: number) => {
    returnLoan.mutate(id);
  };
  
  // Get item name from inventory
  const getItemName = (itemId: number) => {
    if (!inventory) return `Item #${itemId}`;
    const item = inventory.find((item: any) => item.id === itemId);
    return item ? `${item.itemId} - ${item.name}` : `Item #${itemId}`;
  };
  
  // Get status with overdue check
  const getLoanStatus = (loan: any) => {
    if (!loan || !loan.expectedReturnDate) {
      return 'Unknown';
    }
    
    if (loan.status === 'Returned') {
      return 'Returned';
    }
    
    // Check if overdue
    const today = new Date();
    // Handle both string and Date objects
    const expectedReturn = typeof loan.expectedReturnDate === 'string' ? 
      parseISO(loan.expectedReturnDate) : new Date(loan.expectedReturnDate);
    
    if (isAfter(today, expectedReturn)) {
      return 'Overdue';
    }
    
    return 'Ongoing';
  };
  
  // Get status badge class
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Returned':
        return 'bg-green-100 text-green-800';
      case 'Overdue':
        return 'bg-red-100 text-red-800';
      case 'Ongoing':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Borrower</TableHead>
              <TableHead>Date Out</TableHead>
              <TableHead>Expected Return</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(5).fill(0).map((_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div className="w-32 h-5 bg-gray-200 animate-pulse rounded"></div>
                  </TableCell>
                  <TableCell>
                    <div className="w-28 h-5 bg-gray-200 animate-pulse rounded"></div>
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
            ) : loans && loans.length > 0 ? (
              paginatedLoans.map((loan) => {
                const status = getLoanStatus(loan);
                return (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium">
                      {getItemName(loan.itemId)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{loan.borrowerName}</p>
                        <p className="text-sm text-gray-500">({loan.borrowerType})</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {loan.loanDate ? format(new Date(loan.loanDate), 'MMM dd, yyyy') : '—'}
                    </TableCell>
                    <TableCell>
                      {loan.expectedReturnDate ? format(new Date(loan.expectedReturnDate), 'MMM dd, yyyy') : '—'}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(status)}`}>
                        {status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {loan.status !== 'Returned' ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-green-600 hover:text-green-700"
                            >
                              Return Item
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Return Item</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to mark this item as returned? This will update the inventory status to available.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleReturnLoan(loan.id)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                Return Item
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
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  {loans?.length === 0 ? 'No loans found. Process a new loan to get started.' : 'Error loading loan data.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Pagination */}
      {loans && loans.length > 0 && (
        <div className="mt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                />
              </PaginationItem>
              
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                const pageNumber = i + 1;
                return (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink 
                      isActive={currentPage === pageNumber}
                      onClick={() => setCurrentPage(pageNumber)}
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              
              {totalPages > 5 && (
                <>
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink onClick={() => setCurrentPage(totalPages)}>
                      {totalPages}
                    </PaginationLink>
                  </PaginationItem>
                </>
              )}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
          <p className="mt-2 text-sm text-gray-500 text-center">
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, loans.length)} of {loans.length} loans
          </p>
        </div>
      )}
    </div>
  );
}
