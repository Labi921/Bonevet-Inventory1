import { useState } from 'react';
import { useLocation } from 'wouter';
import { format } from 'date-fns';
import { FileText, Eye, Pen, FileSignature } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
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

interface DocumentListProps {
  documents: any[];
  isLoading: boolean;
}

export default function DocumentList({ documents, isLoading }: DocumentListProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Calculate pagination
  const totalPages = Math.ceil((documents?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDocuments = documents?.slice(startIndex, startIndex + itemsPerPage) || [];
  
  // Sign document mutation
  const signDocument = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('PUT', `/api/documents/${id}/sign`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity/recent'] });
      
      toast({
        title: 'Document Signed',
        description: 'You have successfully signed the document.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to sign the document. Please try again.',
        variant: 'destructive',
      });
      console.error('Error signing document:', error);
    },
  });
  
  // Handle sign document
  const handleSignDocument = (id: number) => {
    signDocument.mutate(id);
  };
  
  // Check if user already signed a document
  const isDocumentSignedByUser = (document: any) => {
    if (!user || !document.signedBy) return false;
    return document.signedBy.includes(user.name);
  };
  
  // Get document type badge class
  const getDocTypeClass = (type: string) => {
    switch (type) {
      case 'Acquisition':
        return 'bg-blue-100 text-blue-800';
      case 'Loan':
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
              <TableHead>Document ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Signatures</TableHead>
              <TableHead className="text-right">Actions</TableHead>
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
                    <div className="w-32 h-5 bg-gray-200 animate-pulse rounded"></div>
                  </TableCell>
                  <TableCell>
                    <div className="w-20 h-5 bg-gray-200 animate-pulse rounded"></div>
                  </TableCell>
                  <TableCell>
                    <div className="w-24 h-5 bg-gray-200 animate-pulse rounded"></div>
                  </TableCell>
                  <TableCell>
                    <div className="w-20 h-5 bg-gray-200 animate-pulse rounded"></div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end space-x-2">
                      <div className="w-16 h-8 bg-gray-200 animate-pulse rounded"></div>
                      <div className="w-16 h-8 bg-gray-200 animate-pulse rounded"></div>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : documents && documents.length > 0 ? (
              paginatedDocuments.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-gray-400" />
                      {doc.documentId}
                    </div>
                  </TableCell>
                  <TableCell>{doc.title}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getDocTypeClass(doc.type)}`}>
                      {doc.type}
                    </span>
                  </TableCell>
                  <TableCell>
                    {format(new Date(doc.createdAt), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <span className="text-sm">
                        {doc.signedBy ? doc.signedBy.length : 0} signatures
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => navigate(`/documents/view/${doc.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                      
                      {!isDocumentSignedByUser(doc) ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <FileSignature className="h-4 w-4 mr-2" />
                              Sign
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Sign Document</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to sign this document? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleSignDocument(doc.id)}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                Sign Document
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
                          <FileSignature className="h-4 w-4 mr-2" />
                          Signed
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  {documents?.length === 0 ? 'No documents found. Create a new document to get started.' : 'Error loading document data.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Pagination */}
      {documents && documents.length > 0 && (
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
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, documents.length)} of {documents.length} documents
          </p>
        </div>
      )}
    </div>
  );
}
