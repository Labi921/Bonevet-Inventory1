import { useState } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { itemCategoryEnum, itemStatusEnum, itemUsageEnum } from '@/lib/utils/categoryUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';

// Define a simpler form schema that matches server expectations
const formSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  model: z.string().optional(),
  category: itemCategoryEnum,
  status: itemStatusEnum.default("Available"),
  location: z.string().optional(),
  quantity: z.union([
    z.number().int().positive("Quantity must be a positive integer"),
    z.string().transform((val) => {
      const num = parseInt(val);
      return isNaN(num) ? 1 : num;
    })
  ]).default(1),
  price: z.union([
    z.number().min(0, "Price must be a positive number").optional(),
    z.string().transform((val) => {
      if (!val) return undefined;
      const num = parseFloat(val);
      return isNaN(num) ? undefined : num;
    }).optional()
  ]).optional(),
  usage: itemUsageEnum.default("None"),
  notes: z.string().optional(),
});

export default function AddItemForm() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGeneratingDocument, setIsGeneratingDocument] = useState(false);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      model: '',
      category: 'Equipment',
      status: 'Available',
      location: '',
      quantity: 1,
      price: undefined,
      usage: 'None',
      notes: '',
    },
  });
  
  // Create item mutation
  const createItem = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      try {
        console.log('Submitting data:', data); // Debug the submitted data
        const response = await apiRequest('POST', '/api/inventory', data);
        const result = await response.json();
        console.log('Success response:', result);
        return result;
      } catch (error) {
        console.error('API request error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity/recent'] });
      
      toast({
        title: 'Item Added',
        description: 'The item has been added to the inventory successfully.',
      });
      
      // Generate acquisition document if requested
      if (isGeneratingDocument) {
        // This would be replaced with actual document generation logic
        setTimeout(() => {
          toast({
            title: 'Document Generated',
            description: 'Acquisition document has been generated and is ready for signing.',
          });
          navigate('/documents');
        }, 1000);
      } else {
        navigate('/inventory');
      }
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Failed to add the item. Please try again.';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      console.error('Error adding item:', error);
    },
  });
  
  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createItem.mutate(values);
  };
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1.5">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/inventory')}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Inventory
          </Button>
          <CardTitle>Add New Item</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter item name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter model name/number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Electronics">Electronics</SelectItem>
                        <SelectItem value="Equipment">Equipment</SelectItem>
                        <SelectItem value="Tools">Tools</SelectItem>
                        <SelectItem value="Furniture">Furniture</SelectItem>
                        <SelectItem value="Software">Software</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Available">Available</SelectItem>
                        <SelectItem value="In Use">In Use</SelectItem>
                        <SelectItem value="Loaned Out">Loaned Out</SelectItem>
                        <SelectItem value="Damaged">Damaged</SelectItem>
                        <SelectItem value="Maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter current location" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="usage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>In Use Of</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select usage" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="None">None</SelectItem>
                        <SelectItem value="Staff">Staff</SelectItem>
                        <SelectItem value="Members">Members</SelectItem>
                        <SelectItem value="Others">Others</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (€)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter any additional information about the item"
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex items-center">
              <div className="flex items-center space-x-2 mr-4">
                <input
                  type="checkbox"
                  id="generate-document"
                  checked={isGeneratingDocument}
                  onChange={(e) => setIsGeneratingDocument(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-300 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
                />
                <label htmlFor="generate-document" className="text-sm text-gray-700">
                  Generate acquisition document
                </label>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/inventory')}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createItem.isPending}
              >
                {createItem.isPending ? 'Saving...' : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Item
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
