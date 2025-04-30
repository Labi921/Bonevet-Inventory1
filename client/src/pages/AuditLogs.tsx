import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRequireAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { Download, Filter, Search, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AuditLogs() {
  useRequireAuth('admin'); // Require admin role
  
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Fetch audit logs
  const { data: logs, isLoading } = useQuery({
    queryKey: ['/api/activity'],
  });
  
  // Filter logs based on filters
  const filteredLogs = logs ? logs.filter((log: any) => {
    // Search term filter
    const matchesSearch = 
      log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Action filter
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    
    // Entity filter
    const matchesEntity = entityFilter === 'all' || log.entityType === entityFilter;
    
    return matchesSearch && matchesAction && matchesEntity;
  }) : [];
  
  // Sort logs by timestamp (newest first)
  const sortedLogs = filteredLogs.sort((a: any, b: any) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  // Paginate logs
  const totalPages = Math.ceil(sortedLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLogs = sortedLogs.slice(startIndex, startIndex + itemsPerPage);
  
  // Get action label class
  const getActionClass = (action: string) => {
    switch (action) {
      case 'Create':
        return 'bg-green-100 text-green-800';
      case 'Update':
        return 'bg-blue-100 text-blue-800';
      case 'Delete':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  // Handle export
  const handleExport = () => {
    // Implementation for exporting logs
    console.log('Exporting logs');
  };
  
  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3">
        <CardTitle className="text-lg font-medium">Audit Logs</CardTitle>
        <div className="mt-3 sm:mt-0">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" /> Export Logs
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row md:items-center space-y-3 md:space-y-0 md:space-x-2 mb-4">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="Create">Create</SelectItem>
              <SelectItem value="Update">Update</SelectItem>
              <SelectItem value="Delete">Delete</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Entity Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              <SelectItem value="User">User</SelectItem>
              <SelectItem value="InventoryItem">Inventory Item</SelectItem>
              <SelectItem value="Loan">Loan</SelectItem>
              <SelectItem value="Document">Document</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex-1 relative md:ml-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search logs..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity Type</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead className="max-w-[300px]">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div className="w-24 h-5 bg-gray-200 animate-pulse rounded"></div>
                    </TableCell>
                    <TableCell>
                      <div className="w-20 h-5 bg-gray-200 animate-pulse rounded"></div>
                    </TableCell>
                    <TableCell>
                      <div className="w-16 h-5 bg-gray-200 animate-pulse rounded"></div>
                    </TableCell>
                    <TableCell>
                      <div className="w-24 h-5 bg-gray-200 animate-pulse rounded"></div>
                    </TableCell>
                    <TableCell>
                      <div className="w-16 h-5 bg-gray-200 animate-pulse rounded"></div>
                    </TableCell>
                    <TableCell>
                      <div className="w-full h-5 bg-gray-200 animate-pulse rounded"></div>
                    </TableCell>
                  </TableRow>
                ))
              ) : paginatedLogs.length > 0 ? (
                paginatedLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>{log.userId}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getActionClass(log.action)}`}>
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell>{log.entityType}</TableCell>
                    <TableCell className="font-mono text-sm">{log.entityId}</TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      <span title={log.details}>{log.details}</span>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4 text-gray-500">
                    No audit logs found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        {filteredLogs.length > itemsPerPage && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredLogs.length)} of {filteredLogs.length} logs
            </p>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  />
                </PaginationItem>
                
                {/* Calculate pagination numbers to display */}
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
