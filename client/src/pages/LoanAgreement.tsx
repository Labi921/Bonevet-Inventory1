import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Calendar, FileText, Download, Plus, Trash2, Printer } from 'lucide-react';
import type { InventoryItem } from '@shared/schema';

const loanAgreementSchema = z.object({
  loanDate: z.string().min(1, "Loan date is required"),
  returnDate: z.string().min(1, "Return date is required"),
  borrowerName: z.string().min(1, "Borrower name/institution is required"),
  borrowerPersonalId: z.string().min(1, "Personal ID/NRB is required"),
  borrowerLegalRep: z.string().optional(),
  borrowerAddress: z.string().min(1, "Address is required"),
  borrowerPhone: z.string().min(1, "Phone number is required"),
  borrowerEmail: z.string().email("Valid email is required"),
  bonevevRepresentativeName: z.string().min(1, "BONEVET representative name is required"),
  dailyPenalty: z.string().default("5"),
  equipmentList: z.array(z.object({
    itemId: z.string().min(1, "Item ID is required"),
    name: z.string().min(1, "Equipment name is required"),
    model: z.string().min(1, "Model/ID is required"),
    quantity: z.number().min(1, "Quantity must be at least 1"),
    initialCondition: z.string().min(1, "Initial condition description is required")
  })).min(1, "At least one piece of equipment is required")
});

type LoanAgreementForm = z.infer<typeof loanAgreementSchema>;

interface EquipmentItem {
  itemId: string;
  name: string;
  model: string;
  quantity: number;
  initialCondition: string;
}

export default function LoanAgreement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const [location] = useLocation();

  // Parse pre-fill data from URL parameters
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const prefillParam = urlParams.get('prefill');
  let prefillData: any = null;
  
  try {
    if (prefillParam) {
      prefillData = JSON.parse(decodeURIComponent(prefillParam));
    }
  } catch (error) {
    console.error('Error parsing prefill data:', error);
  }

  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>(
    prefillData?.equipmentList || [
      { itemId: '', name: '', model: '', quantity: 1, initialCondition: '' }
    ]
  );
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [generatedDocumentId, setGeneratedDocumentId] = useState<number | null>(null);

  // Fetch available inventory items
  const { data: inventoryItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ['/api/inventory']
  });

  // Fetch existing loans for pre-filling
  const { data: loans = [] } = useQuery<any[]>({
    queryKey: ['/api/loans']
  });

  // Fetch existing loan groups for pre-filling
  const { data: loanGroups = [] } = useQuery<any[]>({
    queryKey: ['/api/loan-groups']
  });

  const form = useForm<LoanAgreementForm>({
    resolver: zodResolver(loanAgreementSchema),
    defaultValues: {
      loanDate: prefillData?.loanDate || format(new Date(), 'yyyy-MM-dd'),
      returnDate: prefillData?.returnDate || '',
      borrowerName: prefillData?.borrowerName || '',
      borrowerPersonalId: prefillData?.borrowerPersonalId || '',
      borrowerLegalRep: prefillData?.borrowerLegalRep || '',
      borrowerAddress: prefillData?.borrowerAddress || '',
      borrowerPhone: prefillData?.borrowerPhone || (prefillData?.borrowerContact ? prefillData.borrowerContact.split(' | ')[0] : ''),
      borrowerEmail: prefillData?.borrowerEmail || (prefillData?.borrowerContact ? prefillData.borrowerContact.split(' | ')[1] : ''),
      bonevevRepresentativeName: prefillData?.bonevevRepresentativeName || user?.name || '',
      dailyPenalty: prefillData?.dailyPenalty || '5',
      equipmentList: equipmentList
    }
  });

  // Ensure equipment list stays in sync with form
  useEffect(() => {
    form.setValue('equipmentList', equipmentList);
  }, [equipmentList, form]);

  // Generate loan agreement mutation
  const generateAgreementMutation = useMutation({
    mutationFn: async (data: LoanAgreementForm) => {
      const response = await apiRequest('POST', '/api/loan-agreement/generate', data);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Agreement Generated",
        description: "Loan agreement has been generated successfully."
      });
      setGeneratedDocumentId(data.documentId);
      setShowPreview(true);
      // Invalidate documents query to refresh the Documents section
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate loan agreement.",
        variant: "destructive"
      });
    }
  });

  // PDF download mutation 
  const downloadPDFMutation = useMutation({
    mutationFn: async (documentId: number) => {
      const response = await apiRequest('GET', `/api/loan-agreement/${documentId}/download`);
      const blob = await response.blob();
      return blob;
    },
    onSuccess: (blob) => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `Loan_Agreement_${generatedDocumentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Download Started",
        description: "Your loan agreement PDF is downloading."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download PDF.",
        variant: "destructive"
      });
    }
  });

  // Add equipment item
  const addEquipmentItem = () => {
    setEquipmentList([...equipmentList, { itemId: '', name: '', model: '', quantity: 1, initialCondition: '' }]);
  };

  // Remove equipment item
  const removeEquipmentItem = (index: number) => {
    if (equipmentList.length > 1) {
      const newList = equipmentList.filter((_, i) => i !== index);
      setEquipmentList(newList);
      form.setValue('equipmentList', newList);
    }
  };

  // Update equipment item
  const updateEquipmentItem = (index: number, field: keyof EquipmentItem, value: any) => {
    const newList = [...equipmentList];
    newList[index] = { ...newList[index], [field]: value };
    setEquipmentList(newList);
  };

  // Auto-fill from selected inventory item
  const handleInventoryItemSelect = (index: number, itemId: string) => {
    if (!itemId) return;
    
    const selectedItem = inventoryItems.find(item => item.itemId === itemId);
    if (selectedItem) {
      const newList = [...equipmentList];
      newList[index] = {
        ...newList[index],
        itemId: itemId,
        name: selectedItem.name,
        model: selectedItem.model || selectedItem.itemId,
        initialCondition: `Condition: ${selectedItem.status || 'Good'} - Available Quantity: ${selectedItem.quantityAvailable || selectedItem.quantity || 0}`
      };
      setEquipmentList(newList);
    }
  };

  // Pre-fill from existing loan
  const handleLoanSelect = (loanId: string) => {
    if (!loanId) {
      setSelectedLoan(null);
      return;
    }

    // Check if it's a loan group (prefixed with 'group-') or individual loan
    if (loanId.startsWith('group-')) {
      const groupId = loanId.replace('group-', '');
      const selectedLoanGroup = loanGroups.find((group: any) => group.id.toString() === groupId);
      
      if (selectedLoanGroup) {
        setSelectedLoan(selectedLoanGroup);
        
        // Pre-fill form with loan group data
        form.setValue('borrowerName', selectedLoanGroup.borrowerName || '');
        form.setValue('borrowerPhone', selectedLoanGroup.borrowerContact?.split(' | ')[0] || '');
        form.setValue('borrowerEmail', selectedLoanGroup.borrowerContact?.split(' | ')[1] || '');
        form.setValue('loanDate', selectedLoanGroup.loanDate ? format(new Date(selectedLoanGroup.loanDate), 'yyyy-MM-dd') : '');
        form.setValue('returnDate', selectedLoanGroup.expectedReturnDate ? format(new Date(selectedLoanGroup.expectedReturnDate), 'yyyy-MM-dd') : '');
        
        // Pre-fill equipment from loan group items
        const newEquipmentList = (selectedLoanGroup.items || []).map((item: any) => {
          const inventoryItem = inventoryItems.find((inv: any) => inv.id === item.itemId);
          return {
            itemId: inventoryItem?.itemId || '',
            name: inventoryItem?.name || 'Unknown Item',
            model: inventoryItem?.itemId || '',
            quantity: item.quantityLoaned || 1,
            initialCondition: `Condition: ${inventoryItem?.status || 'Unknown'}`
          };
        });
        
        setEquipmentList(newEquipmentList);
        form.setValue('equipmentList', newEquipmentList);
      }
    } else {
      // Handle individual loan
      const selectedLoanData = loans.find((loan: any) => loan.id.toString() === loanId);
      if (selectedLoanData) {
        setSelectedLoan(selectedLoanData);
        
        // Pre-fill form with loan data
        form.setValue('borrowerName', selectedLoanData.borrowerName || '');
        form.setValue('borrowerPhone', selectedLoanData.borrowerContact?.split(' | ')[0] || '');
        form.setValue('borrowerEmail', selectedLoanData.borrowerContact?.split(' | ')[1] || '');
        form.setValue('loanDate', selectedLoanData.loanDate ? format(new Date(selectedLoanData.loanDate), 'yyyy-MM-dd') : '');
        form.setValue('returnDate', selectedLoanData.expectedReturnDate ? format(new Date(selectedLoanData.expectedReturnDate), 'yyyy-MM-dd') : '');
        
        // Pre-fill equipment from loan
        const selectedItem = inventoryItems.find((item: any) => item.id === selectedLoanData.itemId);
        if (selectedItem) {
          const newEquipmentList = [{
            itemId: selectedItem.itemId || '',
            name: selectedItem.name || 'Unknown Item',
            model: selectedItem.itemId || '',
            quantity: selectedLoanData.quantityLoaned || 1,
            initialCondition: `Condition: ${selectedItem.status || 'Unknown'}`
          }];
          
          setEquipmentList(newEquipmentList);
          form.setValue('equipmentList', newEquipmentList);
        }
      }
    }
  };

  const onSubmit = async (data: LoanAgreementForm) => {
    // Ensure we have valid equipment data
    if (!equipmentList.length || equipmentList.some(item => !item.name || !item.itemId)) {
      toast({
        title: "Missing Equipment",
        description: "Please add and select equipment items for the loan agreement.",
        variant: "destructive"
      });
      return;
    }

    const formDataWithEquipment = {
      ...data,
      equipmentList
    };
    
    await generateAgreementMutation.mutateAsync(formDataWithEquipment);
  };

  const handleDownload = () => {
    if (generatedDocumentId) {
      downloadPDFMutation.mutate(generatedDocumentId);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Please log in to access loan agreement generation.</p>
      </div>
    );
  }

  // Debug: Log user object to see the actual structure
  console.log('User object in LoanAgreement:', user);

  // Check if user has required permissions (Admin or Super Admin can generate agreements)
  if (!user.role || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground">You don't have permission to generate loan agreements.</p>
          <p className="text-sm text-gray-500 mt-2">Current role: {user.role || 'No role assigned'}</p>
          <p className="text-xs text-gray-400 mt-1">Required: admin or super_admin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loan Agreement Generator</h1>
          <p className="text-muted-foreground">
            Generate professional Albanian loan agreements with automated PDF export
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {format(new Date(), 'MMMM dd, yyyy')}
          </span>
        </div>
      </div>

      {/* Pre-fill from existing loan */}
      {(loans.length > 0 || loanGroups.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Pre-fill from Existing Loan
            </CardTitle>
            <CardDescription>
              Select an existing loan (individual or multi-item) to automatically populate borrower and equipment information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select onValueChange={handleLoanSelect}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an existing loan to pre-fill data..." />
              </SelectTrigger>
              <SelectContent>
                {loanGroups.length > 0 && (
                  <div>
                    <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">Multi-Item Loan Groups</div>
                    {loanGroups.map((group: any) => (
                      <SelectItem key={`group-${group.id}`} value={`group-${group.id}`}>
                        📦 {group.borrowerName || 'Unknown'} - {group.loanGroupId} ({Array.isArray(group.items) ? group.items.length : 0} items)
                        {group.loanDate && ` - ${format(new Date(group.loanDate), 'MMM dd, yyyy')}`}
                      </SelectItem>
                    ))}
                  </div>
                )}
                {loans.length > 0 && (
                  <div>
                    <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">Individual Loans</div>
                    {loans.map((loan: any) => (
                      <SelectItem key={loan.id} value={loan.id.toString()}>
                        📋 {loan.borrowerName || 'Unknown'} - {inventoryItems.find((item: any) => item.id === loan.itemId)?.name || 'Unknown Item'} 
                        ({loan.loanDate ? format(new Date(loan.loanDate), 'MMM dd, yyyy') : 'Unknown Date'})
                      </SelectItem>
                    ))}
                  </div>
                )}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Loan Information */}
          <Card>
            <CardHeader>
              <CardTitle>Loan Information</CardTitle>
              <CardDescription>Basic loan details and dates</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="loanDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loan Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="returnDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Return Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bonevevRepresentativeName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>BONEVET Representative</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Representative name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dailyPenalty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Daily Penalty (EUR)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="5" type="number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Borrower Information */}
          <Card>
            <CardHeader>
              <CardTitle>Borrower Information</CardTitle>
              <CardDescription>Complete contact and identification details</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="borrowerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name / Institution Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter full name or institution" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="borrowerPersonalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Personal ID / NRB</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Personal ID or NRB number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="borrowerLegalRep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Legal Representative (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Legal representative name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="borrowerAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Complete address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="borrowerPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="+383 XX XXX XXX" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="borrowerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="email@example.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Equipment List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Equipment List
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addEquipmentItem}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Equipment
                </Button>
              </CardTitle>
              <CardDescription>
                Add all equipment items to be included in the loan agreement
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {equipmentList.map((equipment, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Equipment #{index + 1}</h4>
                    {equipmentList.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEquipmentItem(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Select from Inventory</label>
                      <Select 
                        value={equipment.itemId || ""} 
                        onValueChange={(value) => handleInventoryItemSelect(index, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select inventory item..." />
                        </SelectTrigger>
                        <SelectContent>
                          {inventoryItems
                            .filter(item => (item.quantityAvailable || item.quantity || 0) > 0)
                            .map((item) => (
                              <SelectItem key={item.itemId} value={item.itemId}>
                                {item.name} ({item.itemId}) - Available: {item.quantityAvailable || item.quantity || 0}
                              </SelectItem>
                            ))
                          }
                          {inventoryItems.filter(item => (item.quantityAvailable || item.quantity || 0) > 0).length === 0 && (
                            <SelectItem value="no-items" disabled>
                              No available items
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Equipment Name</label>
                      <Input
                        value={equipment.name}
                        onChange={(e) => updateEquipmentItem(index, 'name', e.target.value)}
                        placeholder="Equipment name"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Model/ID</label>
                      <Input
                        value={equipment.model}
                        onChange={(e) => updateEquipmentItem(index, 'model', e.target.value)}
                        placeholder="Model or ID"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Quantity</label>
                      <Input
                        type="number"
                        min="1"
                        value={equipment.quantity}
                        onChange={(e) => updateEquipmentItem(index, 'quantity', parseInt(e.target.value) || 1)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Initial Condition</label>
                    <Textarea
                      value={equipment.initialCondition}
                      onChange={(e) => updateEquipmentItem(index, 'initialCondition', e.target.value)}
                      placeholder="Describe the current condition of the equipment"
                      rows={2}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-between">
            <div className="space-x-2">
              {generatedDocumentId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownload}
                  disabled={downloadPDFMutation.isPending}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {downloadPDFMutation.isPending ? 'Downloading...' : 'Download PDF'}
                </Button>
              )}
            </div>
            
            <Button 
              type="submit" 
              disabled={generateAgreementMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {generateAgreementMutation.isPending ? 'Generating...' : 'Generate Agreement'}
            </Button>
          </div>
        </form>
      </Form>

      {/* Preview Section */}
      {showPreview && generatedDocumentId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Agreement Generated Successfully</span>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={handleDownload}
                  disabled={downloadPDFMutation.isPending}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowPreview(false)}
                >
                  Close Preview
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800">
                ✓ The loan agreement has been generated successfully and saved to the Documents section.
                The inventory quantities have been automatically updated and loan records created.
              </p>
              <p className="text-sm text-green-700 mt-2">
                Document ID: {generatedDocumentId}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}