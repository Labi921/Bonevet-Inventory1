import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Save, ArrowLeft, CalendarIcon, Trash, Package, Search, Plus, Minus } from 'lucide-react';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface MultiItemLoanFormProps {
  preselectedItemId?: number;
}

interface SelectedItem {
  id: number;
  quantity: number;
  maxQuantity: number;
  name: string;
  itemId: string;
}

export default function MultiItemLoanForm({ preselectedItemId }: MultiItemLoanFormProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Form schema
  const loanGroupSchema = z.object({
    items: z.array(z.object({
      id: z.number(),
      quantity: z.number().min(1, "Quantity must be at least 1")
    })).min(1, {
      message: "Please select at least one item",
    }),
    borrowerName: z.string().min(2, {
      message: "Borrower name must be at least 2 characters.",
    }),
    borrowerType: z.string({
      required_error: "Please select a borrower type",
    }),
    borrowerContact: z.string().nullish().or(z.literal('')),
    loanDate: z.date({
      required_error: "Loan date is required",
    }),
    expectedReturnDate: z.date({
      required_error: "Expected return date is required",
    }),
    notes: z.string().nullish().or(z.literal('')),
  }).refine(data => data.expectedReturnDate > data.loanDate, {
    message: "Expected return date must be after the loan date",
    path: ["expectedReturnDate"],
  });

  // Get inventory items for selection
  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['/api/inventory'],
    retry: false,
  });

  // Filter for available items only and include search functionality
  const availableItems = Array.isArray(inventoryItems) 
    ? inventoryItems.filter((item: any) => {
        const hasAvailableQuantity = item.quantityAvailable > 0;
        const matchesSearch = searchTerm === '' || 
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.itemId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.model && item.model.toLowerCase().includes(searchTerm.toLowerCase()));
        return hasAvailableQuantity && matchesSearch;
      })
    : [];

  // Form setup
  const form = useForm<z.infer<typeof loanGroupSchema>>({
    resolver: zodResolver(loanGroupSchema),
    defaultValues: {
      items: [],
      loanDate: new Date(),
      expectedReturnDate: new Date(new Date().setDate(new Date().getDate() + 7)),
    },
  });

  // Set preselected item if available
  useEffect(() => {
    if (preselectedItemId && inventoryItems) {
      const preselectedItem = inventoryItems.find((item: any) => item.id === preselectedItemId);
      if (preselectedItem && preselectedItem.quantityAvailable > 0) {
        const selectedItem: SelectedItem = {
          id: preselectedItem.id,
          quantity: 1,
          maxQuantity: preselectedItem.quantityAvailable,
          name: preselectedItem.name,
          itemId: preselectedItem.itemId
        };
        setSelectedItems([selectedItem]);
        form.setValue('items', [{ id: preselectedItem.id, quantity: 1 }]);
      }
    }
  }, [preselectedItemId, inventoryItems, form]);
  
  // Create loan group mutation
  const createLoanGroup = useMutation({
    mutationFn: async (data: z.infer<typeof loanGroupSchema>) => {
      try {
        console.log('Submitting loan group data:', data);
        const response = await apiRequest('POST', '/api/loan-groups', data);
        const result = await response.json();
        console.log('Loan group success response:', result);
        return result;
      } catch (error) {
        console.error('Loan group API request error details:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loan-groups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity/recent'] });
      
      toast({
        title: 'Loan Processed',
        description: `${selectedItems.length} item(s) have been successfully loaned out.`,
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
      console.error('Error processing loan group:', error);
    },
  });

  const onSubmit = (values: z.infer<typeof loanGroupSchema>) => {
    // Transform selectedItems to the expected format
    const itemsForSubmission = selectedItems.map(item => ({
      id: item.id,
      quantity: item.quantity
    }));
    values.items = itemsForSubmission;
    createLoanGroup.mutate(values);
  };

  const toggleItemSelection = (item: any) => {
    const existingIndex = selectedItems.findIndex(selected => selected.id === item.id);
    
    if (existingIndex >= 0) {
      // Remove the item if already selected
      const updatedItems = selectedItems.filter(selected => selected.id !== item.id);
      setSelectedItems(updatedItems);
      form.setValue('items', updatedItems.map(selected => ({ id: selected.id, quantity: selected.quantity })));
    } else {
      // Add the item if not selected
      const selectedItem: SelectedItem = {
        id: item.id,
        quantity: 1,
        maxQuantity: item.quantityAvailable,
        name: item.name,
        itemId: item.itemId
      };
      const updatedItems = [...selectedItems, selectedItem];
      setSelectedItems(updatedItems);
      form.setValue('items', updatedItems.map(selected => ({ id: selected.id, quantity: selected.quantity })));
    }
  };

  const updateItemQuantity = (itemId: number, newQuantity: number) => {
    const updatedItems = selectedItems.map(item => 
      item.id === itemId ? { ...item, quantity: Math.max(1, Math.min(newQuantity, item.maxQuantity)) } : item
    );
    setSelectedItems(updatedItems);
    form.setValue('items', updatedItems.map(item => ({ id: item.id, quantity: item.quantity })));
  };

  const isItemSelected = (itemId: number) => {
    return selectedItems.some(item => item.id === itemId);
  };

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
          <CardTitle>Process New Multi-Item Loan</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Item Selection Table */}
            <FormField
              control={form.control}
              name="items"
              render={() => (
                <FormItem>
                  <FormLabel>Select Items to Loan *</FormLabel>
                  <FormControl>
                    <Card className="border border-slate-200">
                      <CardContent className="p-4">
                        {/* Search Bar */}
                        <div className="relative mb-4">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                          <Input
                            placeholder="Search items by name, ID, category, or model..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                        
                        <div className="rounded-md border max-h-[400px] overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[50px]">Select</TableHead>
                                <TableHead>ID</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Available</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead className="text-center">Quantity</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {availableItems.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                                    {searchTerm ? "No items found matching your search" : "No available items found"}
                                  </TableCell>
                                </TableRow>
                              ) : (
                                availableItems.map((item: any) => {
                                  const isSelected = isItemSelected(item.id);
                                  const selectedItem = selectedItems.find(s => s.id === item.id);
                                  return (
                                    <TableRow 
                                      key={item.id}
                                      className={isSelected ? "bg-blue-50" : "cursor-pointer hover:bg-slate-50"}
                                      onClick={() => toggleItemSelection(item)}
                                    >
                                      <TableCell onClick={(e) => e.stopPropagation()}>
                                        <Checkbox
                                          checked={isSelected}
                                          onCheckedChange={() => toggleItemSelection(item)}
                                        />
                                      </TableCell>
                                      <TableCell className="font-mono">{item.itemId}</TableCell>
                                      <TableCell>
                                        <div className="font-medium">{item.name}</div>
                                        {item.model && <div className="text-sm text-muted-foreground">{item.model}</div>}
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline">{item.category}</Badge>
                                      </TableCell>
                                      <TableCell>
                                        <span className="text-sm font-medium text-green-600">
                                          {item.quantityAvailable} available
                                        </span>
                                      </TableCell>
                                      <TableCell>{item.location || "—"}</TableCell>
                                      <TableCell onClick={(e) => e.stopPropagation()}>
                                        {isSelected ? (
                                          <div className="flex items-center justify-center space-x-2">
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className="h-8 w-8 p-0"
                                              onClick={() => updateItemQuantity(item.id, selectedItem!.quantity - 1)}
                                              disabled={selectedItem!.quantity <= 1}
                                            >
                                              <Minus className="h-4 w-4" />
                                            </Button>
                                            <span className="w-8 text-center font-medium">
                                              {selectedItem?.quantity || 1}
                                            </span>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className="h-8 w-8 p-0"
                                              onClick={() => updateItemQuantity(item.id, selectedItem!.quantity + 1)}
                                              disabled={selectedItem!.quantity >= item.quantityAvailable}
                                            >
                                              <Plus className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        ) : (
                                          <div className="text-center text-muted-foreground">—</div>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })
                              )}
                            </TableBody>
                          </Table>
                        </div>
                        
                        <div className="mt-4 p-4 bg-blue-50 rounded-md">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center">
                              <Package className="h-5 w-5 mr-2 text-blue-500" />
                              <span className="font-medium">Selected Items: {selectedItems.length}</span>
                              {selectedItems.length > 0 && (
                                <span className="ml-2 text-sm text-gray-600">
                                  (Total: {selectedItems.reduce((sum, item) => sum + item.quantity, 0)} units)
                                </span>
                              )}
                            </div>
                            {selectedItems.length > 0 && (
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="sm"
                                className="text-red-500 text-xs border-red-200 hover:bg-red-50"
                                onClick={() => {
                                  setSelectedItems([]);
                                  form.setValue('items', []);
                                }}
                              >
                                <Trash className="h-3 w-3 mr-1" />
                                Clear Selection
                              </Button>
                            )}
                          </div>
                          
                          {selectedItems.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-gray-700">Selected Items:</div>
                              <div className="space-y-1">
                                {selectedItems.map((item) => (
                                  <div key={item.id} className="flex items-center justify-between bg-white p-2 rounded border">
                                    <div className="flex items-center">
                                      <span className="font-mono text-xs text-gray-500 mr-2">{item.itemId}</span>
                                      <span className="font-medium">{item.name}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="text-sm text-gray-600">
                                        {item.quantity} / {item.maxQuantity}
                                      </span>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                        onClick={() => toggleItemSelection({ id: item.id })}
                                      >
                                        <Trash className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </FormControl>
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
                disabled={createLoanGroup.isPending || selectedItems.length === 0}
              >
                {createLoanGroup.isPending ? 'Processing...' : (
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