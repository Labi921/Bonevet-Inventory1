import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format, addDays } from 'date-fns';
import { CalendarIcon, ArrowLeft, Save } from 'lucide-react';
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
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Loan form schema
const loanSchema = z.object({
  itemId: z.number({
    required_error: "Item is required",
    invalid_type_error: "Item ID must be a number",
  }),
  quantityLoaned: z.number({
    required_error: "Quantity is required",
    invalid_type_error: "Quantity must be a number",
  }).min(1, "Quantity must be at least 1"),
  borrowerName: z.string().min(1, "Borrower name is required"),
  borrowerType: z.string().min(1, "Borrower type is required"),
  borrowerContact: z.string().nullish().or(z.literal('')),
  loanDate: z.date({
    required_error: "Loan date is required",
  }),
  expectedReturnDate: z.date({
    required_error: "Expected return date is required",
  }),
  notes: z.string().nullish().or(z.literal('')),
}).refine(data => {
  const loanDate = new Date(data.loanDate);
  const returnDate = new Date(data.expectedReturnDate);
  return returnDate > loanDate;
}, {
  message: "Return date must be after loan date",
  path: ["expectedReturnDate"],
});

interface LoanFormProps {
  preselectedItemId?: number;
}

export default function LoanForm({ preselectedItemId }: LoanFormProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch available inventory items
  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ['/api/inventory'],
  });
  
  // Filter items to only show ones with quantity > 0 (regardless of status for quantity-based loans)
  const availableItems = Array.isArray(items) ? items.filter((item: any) => 
    (item.quantityAvailable || 0) > 0
  ) : [];
  
  // Get item details by ID
  const getItemById = (id: number) => {
    return Array.isArray(items) ? items.find((item: any) => item.id === id) : null;
  };
  
  // Set up form with default values
  const form = useForm<z.infer<typeof loanSchema>>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      itemId: preselectedItemId || 0,
      quantityLoaned: 1,
      borrowerName: '',
      borrowerType: 'Staff',
      borrowerContact: '',
      loanDate: new Date(),
      expectedReturnDate: addDays(new Date(), 7),
      notes: '',
    },
  });
  
  // Update item selection if preselectedItemId changes
  useEffect(() => {
    if (preselectedItemId) {
      form.setValue('itemId', preselectedItemId);
    }
  }, [preselectedItemId, form]);
  
  // Create loan mutation
  const createLoan = useMutation({
    mutationFn: async (data: z.infer<typeof loanSchema>) => {
      try {
        console.log('Submitting loan data:', data); // Debug the submitted data
        const response = await apiRequest('POST', '/api/loans', data);
        const result = await response.json();
        console.log('Loan success response:', result);
        return result;
      } catch (error) {
        console.error('Loan API request error details:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity/recent'] });
      
      toast({
        title: 'Loan Processed',
        description: 'The item has been successfully loaned out.',
      });
      
      navigate('/loans');
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Failed to process the loan. Please try again.';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      console.error('Error processing loan:', error);
    },
  });
  
  const onSubmit = (values: z.infer<typeof loanSchema>) => {
    createLoan.mutate(values);
  };
  
  const selectedItem = form.watch('itemId') ? getItemById(form.watch('itemId')) : null;
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1.5">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/loans')}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Loans
          </Button>
          <CardTitle>Process New Loan</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="itemId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item *</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    defaultValue={field.value?.toString()}
                    value={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an item" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableItems.length === 0 ? (
                        <SelectItem value="0" disabled>No available items</SelectItem>
                      ) : (
                        availableItems.map((item: any) => (
                          <SelectItem key={item.id} value={item.id.toString()}>
                            {item.itemId} - {item.name} ({item.model || 'No model'}) - Available: {item.quantityAvailable || 0}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {selectedItem && (
                    <div className="mt-2 p-2 bg-blue-50 rounded-md text-sm text-blue-800">
                      <p>Selected: {selectedItem.name} ({selectedItem.itemId})</p>
                      <p>Category: {selectedItem.category}</p>
                      <p>Available Quantity: {selectedItem.quantityAvailable || 0}</p>
                      {selectedItem.location && <p>Location: {selectedItem.location}</p>}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="quantityLoaned"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity to Loan *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max={selectedItem?.quantityAvailable || 999}
                      placeholder="Enter quantity"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    />
                  </FormControl>
                  {selectedItem && (
                    <FormDescription>
                      Available: {selectedItem.quantityAvailable || 0} units
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="borrowerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Borrower Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter borrower's name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="borrowerType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Borrower Type *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select borrower type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Staff">Staff</SelectItem>
                        <SelectItem value="Member">Member</SelectItem>
                        <SelectItem value="Other Organization">Other Organization</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="borrowerContact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Information</FormLabel>
                  <FormControl>
                    <Input placeholder="Email or phone number" {...field} />
                  </FormControl>
                  <FormDescription>
                    How to contact the borrower if needed
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="loanDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Loan Date *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className="w-full pl-3 text-left font-normal"
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="expectedReturnDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Expected Return Date *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className="w-full pl-3 text-left font-normal"
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < form.getValues('loanDate')}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
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
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Any additional information about the loan"
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/loans')}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createLoan.isPending}
              >
                {createLoan.isPending ? 'Processing...' : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Process Loan
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
