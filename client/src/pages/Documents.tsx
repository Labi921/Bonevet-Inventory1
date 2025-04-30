import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { PlusCircle, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DocumentList from '@/components/documents/DocumentList';
import DocumentForm from '@/components/documents/DocumentForm';
import DocumentViewer from '@/components/documents/DocumentViewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Documents() {
  const [location] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  
  // Check if we're on a sub-route
  const isNewDocument = location === '/documents/new';
  const isViewDocument = location.startsWith('/documents/view/');
  const documentId = isViewDocument ? location.split('/documents/view/')[1] : null;
  
  // Fetch documents
  const { data: documents, isLoading } = useQuery({
    queryKey: ['/api/documents'],
  });
  
  // Filter documents based on search term and type filter
  const filteredDocuments = documents ? documents.filter((doc: any) => {
    // Search term filter
    const matchesSearch = 
      doc.documentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.relatedItemId && doc.relatedItemId.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Type filter
    const matchesType = typeFilter === 'all' || doc.type === typeFilter;
    
    return matchesSearch && matchesType;
  }) : [];
  
  if (isNewDocument) {
    return <DocumentForm />;
  }
  
  if (isViewDocument && documentId) {
    return <DocumentViewer id={documentId} />;
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3">
        <CardTitle className="text-lg font-medium">Document Management</CardTitle>
        <div className="mt-3 sm:mt-0 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <Button asChild>
            <a href="/documents/new">
              <PlusCircle className="h-4 w-4 mr-2" /> Create New Document
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0 mb-4">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Document Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Acquisition">Acquisition</SelectItem>
                <SelectItem value="Loan">Loan</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search documents..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <DocumentList documents={filteredDocuments} isLoading={isLoading} />
      </CardContent>
    </Card>
  );
}
