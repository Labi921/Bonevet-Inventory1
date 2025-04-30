import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { generateDocumentId } from '@/lib/utils/documentUtils';
import { ArrowLeft, Save } from 'lucide-react';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Document form schema
const documentSchema = z.object({
  type: z.string().min(1, "Document type is required"),
  title: z.string().min(1, "Title is required"),
  relatedItemId: z.string().optional(),
  content: z.string().min(1, "Content is required"),
});

export default function DocumentForm() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [docType, setDocType] = useState('Acquisition');
  
  // Get query parameters
  const location = typeof window !== 'undefined' ? window.location.search : '';
  const params = new URLSearchParams(location);
  const initialDocType = params.get('type') || 'Acquisition';
  const initialItemId = params.get('itemId') || '';
  
  // Fetch inventory items for selection
  const { data: items } = useQuery({
    queryKey: ['/api/inventory'],
  });
  
  // Set up form with default values
  const form = useForm<z.infer<typeof documentSchema>>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      type: initialDocType,
      title: '',
      relatedItemId: initialItemId,
      content: '',
    },
  });
  
  // Update content template when document type changes
  useEffect(() => {
    const type = form.getValues('type');
    setDocType(type);
    
    // Set a default title based on type
    if (type === 'Acquisition') {
      form.setValue('title', 'Item Acquisition Document');
    } else if (type === 'Loan') {
      form.setValue('title', 'Item Loan Agreement');
    }
    
    // Set template content based on type
    const selectedItemId = form.getValues('relatedItemId');
    const selectedItem = selectedItemId 
      ? items?.find((item: any) => item.id.toString() === selectedItemId)
      : null;
    
    if (type === 'Acquisition' && selectedItem) {
      form.setValue('content', JSON.stringify({
        documentType: 'Acquisition',
        itemDetails: {
          itemId: selectedItem.itemId,
          name: selectedItem.name,
          category: selectedItem.category,
          model: selectedItem.model,
          price: selectedItem.price,
          quantity: selectedItem.quantity
        },
        acquisitionType: 'Purchase',
        acquisitionDate: new Date().toISOString(),
        notes: `This item was added to the BONEVET Gjakova inventory on ${new Date().toLocaleDateString()}.`,
        signatories: ['CEO', 'CTO']
      }, null, 2));
    } else if (type === 'Loan' && selectedItem) {
      form.setValue('content', JSON.stringify({
        documentType: 'Loan',
        itemDetails: {
          itemId: selectedItem.itemId,
          name: selectedItem.name,
          category: selectedItem.category,
          model: selectedItem.model
        },
        loanDetails: {
          borrowerName: '',
          borrowerType: '',
          loanDate: new Date().toISOString(),
          expectedReturnDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        termsAndConditions: 'The borrower agrees to return the item in the same condition as received. Any damages will be the responsibility of the borrower.',
        signatories: ['Lender', 'Borrower']
      }, null, 2));
    } else {
      // Default empty template
      form.setValue('content', JSON.stringify({
        documentType: type,
        date: new Date().toISOString(),
        details: '',
        signatories: []
      }, null, 2));
    }
  }, [form.getValues('type'), items, form]);
  
  // Update content when related item changes
  const watchRelatedItem = form.watch('relatedItemId');
  useEffect(() => {
    if (watchRelatedItem) {
      const selectedItem = items?.find((item: any) => item.id.toString() === watchRelatedItem);
      if (selectedItem) {
        try {
          const currentContent = JSON.parse(form.getValues('content'));
          if (docType === 'Acquisition') {
            const updatedContent = {
              ...currentContent,
              itemDetails: {
                itemId: selectedItem.itemId,
                name: selectedItem.name,
                category: selectedItem.category,
                model: selectedItem.model,
                price: selectedItem.price,
                quantity: selectedItem.quantity
              }
            };
            form.setValue('content', JSON.stringify(updatedContent, null, 2));
          } else if (docType === 'Loan') {
            const updatedContent = {
              ...currentContent,
              itemDetails: {
                itemId: selectedItem.itemId,
                name: selectedItem.name,
                category: selectedItem.category,
                model: selectedItem.model
              }
            };
            form.setValue('content', JSON.stringify(updatedContent, null, 2));
          }
        } catch (e) {
          // If content is not valid JSON, don't update it
        }
      }
    }
  }, [watchRelatedItem, items, docType, form]);
  
  // Create document mutation
  const createDocument = useMutation({
    mutationFn: async (data: z.infer<typeof documentSchema>) => {
      // Generate a unique document ID
      const documentId = generateDocumentId(data.type);
      
      const response = await apiRequest('POST', '/api/documents', {
        ...data,
        documentId,
        signedBy: [] // No signatures yet
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity/recent'] });
      
      toast({
        title: 'Document Created',
        description: 'The document has been created successfully.',
      });
      
      navigate('/documents');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to create the document. Please try again.',
        variant: 'destructive',
      });
      console.error('Error creating document:', error);
    },
  });
  
  const onSubmit = (values: z.infer<typeof documentSchema>) => {
    createDocument.mutate(values);
  };
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1.5">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/documents')}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Documents
          </Button>
          <CardTitle>Create New Document</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Type *</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        setDocType(value);
                      }}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select document type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Acquisition">Acquisition</SelectItem>
                        <SelectItem value="Loan">Loan</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      This determines the document template
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter document title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="relatedItemId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Related Item</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select related item (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {items?.map((item: any) => (
                        <SelectItem key={item.id} value={item.id.toString()}>
                          {item.itemId} - {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    This connects the document to a specific inventory item
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Content *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter document content (JSON format)"
                      className="min-h-[300px] font-mono text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Document content in JSON format. Please maintain the structure.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/documents')}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createDocument.isPending}
              >
                {createDocument.isPending ? 'Creating...' : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create Document
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
