import { useQuery } from '@tanstack/react-query';
import { format, isAfter } from 'date-fns';
import { Link } from 'wouter';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function RecentLoans() {
  const { data: loans = [], isLoading } = useQuery({
    queryKey: ['/api/loans/recent?limit=5'],
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['/api/inventory'],
  });

  const getItemName = (itemId: number, isGroupLoan: boolean, loanGroupId: string | number | null, itemCount?: number) => {
    if (!Array.isArray(inventory)) return 'Loading...';
    const item = inventory.find((item: any) => item.id === itemId);
    
    if (isGroupLoan && loanGroupId && itemCount) {
      return `${loanGroupId} (${itemCount} items)`;
    }
    
    return item ? `${item.itemId} - ${item.name}` : `Item #${itemId}`;
  };

  const getLoanStatusBadge = (loan: any) => {
    let className = "px-2 inline-flex text-xs leading-5 font-semibold rounded-full ";
    
    if (loan.status === 'Returned') {
      className += "bg-green-100 text-green-800";
      return <span className={className}>Returned</span>;
    }
    
    if (loan.status === 'Ongoing') {
      // Check if overdue
      if (!loan.expectedReturnDate) {
        className += "bg-amber-100 text-amber-800";
        return <span className={className}>Ongoing</span>;
      }
      
      const isOverdue = isAfter(new Date(), new Date(loan.expectedReturnDate));
      
      if (isOverdue) {
        className += "bg-red-100 text-red-800";
        return <span className={className}>Overdue</span>;
      } else {
        className += "bg-amber-100 text-amber-800";
        return <span className={className}>Ongoing</span>;
      }
    }
    
    return <span className={className}>{loan.status}</span>;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-md font-medium">Recent Loans</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Borrower</TableHead>
                <TableHead>Date Out</TableHead>
                <TableHead>Expected Return</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(3).fill(0).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div className="w-28 h-5 bg-gray-200 animate-pulse rounded"></div>
                    </TableCell>
                    <TableCell>
                      <div className="w-36 h-5 bg-gray-200 animate-pulse rounded"></div>
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
                  </TableRow>
                ))
              ) : Array.isArray(loans) && loans.length > 0 ? (
                loans.map((loan: any) => (
                  <TableRow key={loan.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="font-medium text-gray-800">{getItemName(loan.itemId)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-gray-600">
                      {loan.borrowerName} ({loan.borrowerType})
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-gray-600">
                      {loan.loanDate ? format(new Date(loan.loanDate), 'MMM dd, yyyy') : '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-gray-600">
                      {loan.expectedReturnDate ? format(new Date(loan.expectedReturnDate), 'MMM dd, yyyy') : '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {getLoanStatusBadge(loan)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4 text-gray-500">
                    No recent loans found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4">
          <a href="/loans" className="text-sm font-medium text-primary-600 hover:text-primary-800">
            View all loans →
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
