import { useLocation } from 'wouter';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface InventoryTableProps {
  items: any[];
  isLoading: boolean;
}

export default function InventoryTable({ items, isLoading }: InventoryTableProps) {
  const [, navigate] = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Calculate pagination
  const totalPages = Math.ceil((items?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = items?.slice(startIndex, startIndex + itemsPerPage) || [];
  
  const handleViewItem = (id: string) => {
    navigate(`/inventory/view/${id}`);
  };
  
  const handleEditItem = (id: string) => {
    navigate(`/inventory/edit/${id}`);
  };
  
  const handleLoanItem = (id: string) => {
    navigate(`/loans/new?itemId=${id}`);
  };
  
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Available':
        return 'bg-green-100 text-green-800';
      case 'In Use':
        return 'bg-amber-100 text-amber-800';
      case 'Loaned Out':
        return 'bg-yellow-100 text-yellow-800';
      case 'Damaged':
        return 'bg-red-100 text-red-800';
      case 'Maintenance':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="w-[80px]">Quantity</TableHead>
              <TableHead>Price</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(5).fill(0).map((_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div className="w-16 h-5 bg-gray-200 animate-pulse rounded"></div>
                  </TableCell>
                  <TableCell>
                    <div className="w-32 h-5 bg-gray-200 animate-pulse rounded"></div>
                  </TableCell>
                  <TableCell>
                    <div className="w-20 h-5 bg-gray-200 animate-pulse rounded"></div>
                  </TableCell>
                  <TableCell>
                    <div className="w-24 h-5 bg-gray-200 animate-pulse rounded"></div>
                  </TableCell>
                  <TableCell>
                    <div className="w-24 h-5 bg-gray-200 animate-pulse rounded"></div>
                  </TableCell>
                  <TableCell>
                    <div className="w-12 h-5 bg-gray-200 animate-pulse rounded"></div>
                  </TableCell>
                  <TableCell>
                    <div className="w-16 h-5 bg-gray-200 animate-pulse rounded"></div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <div className="w-12 h-5 bg-gray-200 animate-pulse rounded"></div>
                      <div className="w-12 h-5 bg-gray-200 animate-pulse rounded"></div>
                      <div className="w-12 h-5 bg-gray-200 animate-pulse rounded"></div>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : items && items.length > 0 ? (
              paginatedItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.itemId}</TableCell>
                  <TableCell>
                    <div className="font-medium text-gray-900">{item.name}</div>
                    {item.model && <div className="text-gray-500 text-sm">{item.model}</div>}
                  </TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(item.status)}`}>
                      {item.status}
                    </span>
                  </TableCell>
                  <TableCell>{item.location}</TableCell>
                  <TableCell className="text-center font-medium">{item.quantity}</TableCell>
                  <TableCell>{item.price ? `€${item.price.toFixed(2)}` : '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      className="text-primary-600 hover:text-primary-900" 
                      onClick={() => handleViewItem(item.id)}
                    >
                      View
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="text-gray-600 hover:text-gray-900" 
                      onClick={() => handleEditItem(item.id)}
                    >
                      Edit
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="text-amber-600 hover:text-amber-900"
                      onClick={() => handleLoanItem(item.id)}
                      disabled={item.status !== 'Available'}
                    >
                      Loan
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  {items?.length === 0 ? 'No items found. Try a different search or add a new item.' : 'Error loading inventory data.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Pagination */}
      {items && items.length > 0 && (
        <div className="mt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  aria-disabled={currentPage === 1}
                />
              </PaginationItem>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink 
                      isActive={pageNum === currentPage}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
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
                  aria-disabled={currentPage === totalPages}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
          <p className="mt-2 text-sm text-gray-500 text-center">
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, items.length)} of {items.length} items
          </p>
        </div>
      )}
    </div>
  );
}
