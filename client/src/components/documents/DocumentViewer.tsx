import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ArrowLeft, Printer, FileSignature, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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

interface DocumentViewerProps {
  id: string;
}

export default function DocumentViewer({ id }: DocumentViewerProps) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch document details
  const { data: document, isLoading } = useQuery({
    queryKey: [`/api/documents/${id}`],
  });
  
  // Fetch related item if available
  const { data: items } = useQuery({
    queryKey: ['/api/inventory'],
  });
  
  // Sign document mutation
  const signDocument = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('PUT', `/api/documents/${id}/sign`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/documents/${id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      
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
  
  // Handle print document
  const handlePrint = () => {
    window.print();
  };
  
  // Handle sign document
  const handleSignDocument = () => {
    signDocument.mutate();
  };
  
  // Check if user already signed this document
  const isDocumentSignedByUser = () => {
    if (!user || !document?.signedBy) return false;
    return document.signedBy.includes(user.name);
  };
  
  // Parse document content
  const getDocumentContent = () => {
    if (!document?.content) return null;
    
    try {
      return JSON.parse(document.content);
    } catch (e) {
      return null;
    }
  };
  
  // Get related item details
  const getRelatedItem = () => {
    if (!document?.relatedItemId || !items) return null;
    return items.find((item: any) => item.itemId === document.relatedItemId);
  };
  
  const documentContent = getDocumentContent();
  const relatedItem = getRelatedItem();
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/documents')}
            className="w-fit mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Documents
          </Button>
          <div className="h-8 w-64 bg-gray-200 animate-pulse rounded"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="h-96 bg-gray-200 animate-pulse rounded-md"></div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!document) {
    return (
      <Card>
        <CardHeader>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/documents')}
            className="w-fit mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Documents
          </Button>
          <CardTitle>Document Not Found</CardTitle>
        </CardHeader>
        <CardContent>
          <p>The requested document could not be found. It may have been deleted or you may not have permission to view it.</p>
          <Button onClick={() => navigate('/documents')} className="mt-4">
            Return to Documents
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="print:hidden">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/documents')}
            className="w-fit mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Documents
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between">
          <CardTitle className="text-xl">{document.title}</CardTitle>
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
            {document.type}
          </span>
        </div>
        <p className="text-sm text-gray-500">{document.documentId}</p>
      </CardHeader>
      <CardContent>
        <div className="print:hidden flex justify-end space-x-2 mb-4">
          <Button 
            variant="outline" 
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => {
              // Implementation for downloading as PDF
              toast({
                title: "Document Download Started",
                description: "Your document is being prepared for download."
              });
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          
          {!isDocumentSignedByUser() ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <FileSignature className="h-4 w-4 mr-2" />
                  Sign Document
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
                    onClick={handleSignDocument}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Sign Document
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button disabled>
              <FileSignature className="h-4 w-4 mr-2" />
              Already Signed
            </Button>
          )}
        </div>
        
        <div className="p-6 border rounded-md bg-white min-h-[60vh]">
          <div className="text-center mb-6">
            <div className="h-16 w-16 mx-auto rounded-md bg-primary-600 flex items-center justify-center text-white mb-2">
              <span className="text-2xl font-bold">BV</span>
            </div>
            <h2 className="text-xl font-bold">BONEVET Gjakova</h2>
            <p className="text-gray-500">{document.type} Document</p>
          </div>
          
          <Separator className="my-4" />
          
          {document.type === 'Acquisition' && documentContent ? (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Item Acquisition Document</h3>
              
              <div className="border rounded-md p-4 bg-gray-50">
                <h4 className="font-medium">Item Details</h4>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <p className="text-sm text-gray-500">Item ID:</p>
                    <p>{documentContent.itemDetails?.itemId || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Item Name:</p>
                    <p>{documentContent.itemDetails?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Category:</p>
                    <p>{documentContent.itemDetails?.category || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Model:</p>
                    <p>{documentContent.itemDetails?.model || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Quantity:</p>
                    <p>{documentContent.itemDetails?.quantity || 1}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Unit Price:</p>
                    <p>{documentContent.itemDetails?.price ? `€${documentContent.itemDetails.price}` : 'N/A'}</p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Acquisition Type:</p>
                  <p>{documentContent.acquisitionType || 'Purchase'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Acquisition Date:</p>
                  <p>{documentContent.acquisitionDate ? format(new Date(documentContent.acquisitionDate), 'MMMM dd, yyyy') : format(new Date(), 'MMMM dd, yyyy')}</p>
                </div>
              </div>
              
              {documentContent.notes && (
                <div>
                  <p className="text-sm text-gray-500">Additional Notes:</p>
                  <p className="whitespace-pre-line">{documentContent.notes}</p>
                </div>
              )}
              
              <Separator className="my-4" />
              
              <div>
                <h4 className="font-medium mb-2">Signatures:</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">CEO Signature:</p>
                    <div className="mt-1 h-10 border-b border-gray-300">
                      {document.signedBy?.some(name => name.includes('CEO') || name === user?.name && user?.role === 'admin') && (
                        <p className="text-sm italic text-blue-600">Digitally Signed</p>
                      )}
                    </div>
                    <p className="text-sm mt-1">Date: _________________</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">CTO Signature:</p>
                    <div className="mt-1 h-10 border-b border-gray-300">
                      {document.signedBy?.some(name => name.includes('CTO') || (name === user?.name && user?.role !== 'admin')) && (
                        <p className="text-sm italic text-blue-600">Digitally Signed</p>
                      )}
                    </div>
                    <p className="text-sm mt-1">Date: _________________</p>
                  </div>
                </div>
              </div>
            </div>
          ) : document.type === 'Loan' && documentContent ? (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Loan Agreement</h3>
              
              <div className="border rounded-md p-4 bg-gray-50">
                <h4 className="font-medium">Item Details</h4>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <p className="text-sm text-gray-500">Item ID:</p>
                    <p>{documentContent.itemDetails?.itemId || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Item Name:</p>
                    <p>{documentContent.itemDetails?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Category:</p>
                    <p>{documentContent.itemDetails?.category || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Model:</p>
                    <p>{documentContent.itemDetails?.model || 'N/A'}</p>
                  </div>
                </div>
              </div>
              
              <div className="border rounded-md p-4 bg-gray-50">
                <h4 className="font-medium">Loan Details</h4>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <p className="text-sm text-gray-500">Borrower Name:</p>
                    <p>{documentContent.loanDetails?.borrowerName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Borrower Type:</p>
                    <p>{documentContent.loanDetails?.borrowerType || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Loan Date:</p>
                    <p>{documentContent.loanDetails?.loanDate ? format(new Date(documentContent.loanDetails.loanDate), 'MMMM dd, yyyy') : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Expected Return Date:</p>
                    <p>{documentContent.loanDetails?.expectedReturnDate ? format(new Date(documentContent.loanDetails.expectedReturnDate), 'MMMM dd, yyyy') : 'N/A'}</p>
                  </div>
                </div>
              </div>
              
              {documentContent.termsAndConditions && (
                <div>
                  <p className="text-sm text-gray-500">Terms and Conditions:</p>
                  <p className="whitespace-pre-line">{documentContent.termsAndConditions}</p>
                </div>
              )}
              
              <Separator className="my-4" />
              
              <div>
                <h4 className="font-medium mb-2">Signatures:</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Lender Signature:</p>
                    <div className="mt-1 h-10 border-b border-gray-300">
                      {document.signedBy?.some(name => name === user?.name && user?.role === 'admin') && (
                        <p className="text-sm italic text-blue-600">Digitally Signed</p>
                      )}
                    </div>
                    <p className="text-sm mt-1">Date: _________________</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Borrower Signature:</p>
                    <div className="mt-1 h-10 border-b border-gray-300">
                      {document.signedBy?.some(name => name !== user?.name || user?.role !== 'admin') && (
                        <p className="text-sm italic text-blue-600">Digitally Signed</p>
                      )}
                    </div>
                    <p className="text-sm mt-1">Date: _________________</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-500">Document Content:</p>
              <pre className="whitespace-pre-wrap mt-2 p-4 bg-gray-50 rounded-md border text-sm font-mono overflow-auto">
                {document.content}
              </pre>
              
              <Separator className="my-4" />
              
              <div>
                <h4 className="font-medium mb-2">Signatures:</h4>
                <div className="grid grid-cols-2 gap-4">
                  {document.signedBy && document.signedBy.length > 0 ? (
                    document.signedBy.map((name: string, index: number) => (
                      <div key={index}>
                        <p className="text-sm text-gray-500">Signed by:</p>
                        <div className="mt-1 h-10 border-b border-gray-300">
                          <p className="text-sm italic text-blue-600">{name} (Digitally Signed)</p>
                        </div>
                        <p className="text-sm mt-1">Date: {format(new Date(), 'MMMM dd, yyyy')}</p>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2">
                      <p>No signatures yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="mt-8 text-center">
            <p className="text-xs text-gray-500">This is an official document of BONEVET Gjakova.</p>
            <p className="text-xs text-gray-500">Document ID: {document.documentId} • Created on {format(new Date(document.createdAt), 'MMMM dd, yyyy')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
