import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
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

  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([
    { itemId: '', name: '', model: '', quantity: 1, initialCondition: '' }
  ]);
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

  const form = useForm<LoanAgreementForm>({
    resolver: zodResolver(loanAgreementSchema),
    defaultValues: {
      loanDate: format(new Date(), 'yyyy-MM-dd'),
      returnDate: '',
      borrowerName: '',
      borrowerPersonalId: '',
      borrowerLegalRep: '',
      borrowerAddress: '',
      borrowerPhone: '',
      borrowerEmail: '',
      bonevevRepresentativeName: user?.name || '',
      dailyPenalty: '5',
      equipmentList: equipmentList
    }
  });

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

  // Download PDF function
  const downloadPDF = async () => {
    if (!generatedDocumentId) {
      toast({
        title: "No Document",
        description: "Please generate an agreement first.",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch(`/api/loan-agreement/${generatedDocumentId}/download`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `Loan_Agreement_${generatedDocumentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Started",
        description: "PDF download has started successfully."
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download the PDF document.",
        variant: "destructive"
      });
    }
  };

  const addEquipmentRow = () => {
    const newEquipment: EquipmentItem = {
      itemId: '',
      name: '',
      model: '',
      quantity: 1,
      initialCondition: ''
    };
    setEquipmentList([...equipmentList, newEquipment]);
    form.setValue('equipmentList', [...equipmentList, newEquipment]);
  };

  const removeEquipmentRow = (index: number) => {
    if (equipmentList.length > 1) {
      const newList = equipmentList.filter((_, i) => i !== index);
      setEquipmentList(newList);
      form.setValue('equipmentList', newList);
    }
  };

  const updateEquipmentItem = (index: number, field: keyof EquipmentItem, value: any) => {
    const newList = [...equipmentList];
    newList[index] = { ...newList[index], [field]: value };
    
    // Auto-fill equipment details if item selected from inventory
    if (field === 'itemId' && value) {
      const selectedItem = inventoryItems.find(item => item.itemId === value);
      if (selectedItem) {
        newList[index].name = selectedItem.name;
        newList[index].model = selectedItem.itemId; // Using itemId as model for now
        newList[index].initialCondition = `Condition: ${selectedItem.status}`;
      }
    }
    
    setEquipmentList(newList);
    form.setValue('equipmentList', newList);
  };

  const fillFromExistingLoan = (loanId: string) => {
    const loan = loans.find((l: any) => l.id.toString() === loanId);
    if (loan) {
      form.setValue('borrowerName', loan.borrowerName);
      form.setValue('borrowerPhone', loan.contactInfo);
      form.setValue('borrowerEmail', loan.borrowerEmail || '');
      form.setValue('loanDate', format(new Date(loan.loanDate), 'yyyy-MM-dd'));
      if (loan.expectedReturnDate) {
        form.setValue('returnDate', format(new Date(loan.expectedReturnDate), 'yyyy-MM-dd'));
      }
      
      // Fill equipment if available
      if (loan.itemId && loan.itemName) {
        const equipment: EquipmentItem = {
          itemId: loan.itemId,
          name: loan.itemName,
          model: loan.itemId,
          quantity: 1,
          initialCondition: 'Good condition'
        };
        setEquipmentList([equipment]);
        form.setValue('equipmentList', [equipment]);
      }
      
      setSelectedLoan(loan);
      toast({
        title: "Loan Data Loaded",
        description: "Form has been pre-filled with existing loan information."
      });
    }
  };

  const handlePrint = () => {
    if (printRef.current) {
      const printContents = printRef.current.innerHTML;
      const originalContents = document.body.innerHTML;
      document.body.innerHTML = printContents;
      window.print();
      document.body.innerHTML = originalContents;
      window.location.reload();
    }
  };

  const onSubmit = (data: LoanAgreementForm) => {
    generateAgreementMutation.mutate(data);
  };

  if (!user || !['admin', 'super_admin'].includes(user.role)) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Loan Agreement Generator</h2>
          <p className="text-muted-foreground">
            Generate fillable Albanian loan agreement documents for equipment borrowing.
          </p>
        </div>
        
        {showPreview && (
          <Button onClick={handlePrint} className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Print Agreement
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Agreement Details
            </CardTitle>
            <CardDescription>
              Fill in the loan agreement information. You can pre-fill data from existing loans.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Load from existing loan */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Pre-fill from existing loan (optional)</label>
              <Select onValueChange={fillFromExistingLoan}>
                <SelectTrigger data-testid="select-existing-loan">
                  <SelectValue placeholder="Select an existing loan..." />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(loans) && loans.map((loan: any) => (
                    <SelectItem key={loan.id} value={loan.id.toString()}>
                      {loan.borrowerName} - {loan.itemName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="loanDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Loan Date</FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-loan-date" {...field} />
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
                        <FormLabel>Return Date</FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-return-date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Borrower Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Borrower Information</h3>
                  
                  <FormField
                    control={form.control}
                    name="borrowerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name / Institution</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter name or institution" data-testid="input-borrower-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="borrowerPersonalId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Personal ID / NRB</FormLabel>
                          <FormControl>
                            <Input placeholder="Personal ID or NRB" data-testid="input-personal-id" {...field} />
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
                          <FormLabel>Legal Representative (optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Legal representative" data-testid="input-legal-rep" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="borrowerAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input placeholder="Full address" data-testid="input-address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="borrowerPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="+383 XX XXX XXX" data-testid="input-phone" {...field} />
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
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="email@example.com" data-testid="input-email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Equipment Section */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Equipment List</h3>
                    <Button
                      type="button"
                      onClick={addEquipmentRow}
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-2"
                      data-testid="button-add-equipment"
                    >
                      <Plus className="h-4 w-4" />
                      Add Equipment
                    </Button>
                  </div>
                  
                  {equipmentList.map((equipment, index) => (
                    <Card key={index} className="p-4">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-medium">Equipment {index + 1}</h4>
                        {equipmentList.length > 1 && (
                          <Button
                            type="button"
                            onClick={() => removeEquipmentRow(index)}
                            size="sm"
                            variant="destructive"
                            data-testid={`button-remove-equipment-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">Select from Inventory</label>
                          <Select
                            value={equipment.itemId}
                            onValueChange={(value) => updateEquipmentItem(index, 'itemId', value)}
                          >
                            <SelectTrigger data-testid={`select-equipment-${index}`}>
                              <SelectValue placeholder="Choose equipment..." />
                            </SelectTrigger>
                            <SelectContent>
                              {inventoryItems
                                .filter(item => item.status === 'Available')
                                .map((item) => (
                                  <SelectItem key={item.itemId} value={item.itemId}>
                                    {item.name} ({item.itemId})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium">Quantity</label>
                          <Input
                            type="number"
                            min="1"
                            value={equipment.quantity}
                            onChange={(e) => updateEquipmentItem(index, 'quantity', parseInt(e.target.value) || 1)}
                            data-testid={`input-quantity-${index}`}
                          />
                        </div>
                        
                        <div className="col-span-2">
                          <label className="text-sm font-medium">Equipment Name</label>
                          <Input
                            value={equipment.name}
                            onChange={(e) => updateEquipmentItem(index, 'name', e.target.value)}
                            placeholder="Equipment name"
                            data-testid={`input-equipment-name-${index}`}
                          />
                        </div>
                        
                        <div className="col-span-2">
                          <label className="text-sm font-medium">Model/ID</label>
                          <Input
                            value={equipment.model}
                            onChange={(e) => updateEquipmentItem(index, 'model', e.target.value)}
                            placeholder="Model or ID number"
                            data-testid={`input-equipment-model-${index}`}
                          />
                        </div>
                        
                        <div className="col-span-2">
                          <label className="text-sm font-medium">Initial Condition</label>
                          <Textarea
                            value={equipment.initialCondition}
                            onChange={(e) => updateEquipmentItem(index, 'initialCondition', e.target.value)}
                            placeholder="Describe the initial condition of the equipment"
                            data-testid={`textarea-condition-${index}`}
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Additional Settings */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="bonevevRepresentativeName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>BONEVET Representative</FormLabel>
                        <FormControl>
                          <Input placeholder="Representative name" data-testid="input-representative" {...field} />
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
                        <FormLabel>Daily Penalty (€)</FormLabel>
                        <FormControl>
                          <Input placeholder="5" data-testid="input-daily-penalty" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-4">
                  <Button 
                    type="submit" 
                    className="flex-1" 
                    disabled={generateAgreementMutation.isPending}
                    data-testid="button-generate-agreement"
                  >
                    {generateAgreementMutation.isPending ? 'Generating...' : 'Generate Agreement'}
                  </Button>
                  
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={downloadPDF}
                    disabled={!generatedDocumentId}
                    data-testid="button-download-pdf"
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Preview Section */}
        {showPreview && (
          <Card>
            <CardHeader>
              <CardTitle>Agreement Preview</CardTitle>
              <CardDescription>
                Generated Albanian loan agreement ready for printing and signing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div ref={printRef} className="print-content">
                <LoanAgreementDocument form={form.getValues()} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Albanian Loan Agreement Document Component
function LoanAgreementDocument({ form }: { form: LoanAgreementForm }) {
  return (
    <div className="p-6 bg-white text-black font-serif text-sm leading-6" style={{ maxWidth: '210mm', margin: '0 auto' }}>
      <style>{`
        @media print {
          .print-content {
            font-size: 12pt !important;
            line-height: 1.4 !important;
          }
          .print-content table {
            border-collapse: collapse !important;
          }
          .print-content th, .print-content td {
            border: 1px solid black !important;
            padding: 8px !important;
          }
        }
      `}</style>
      
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold">MARRËVESHJE PËR HUAZIM TË PAJISJEVE</h1>
      </div>

      <div className="mb-6">
        <div className="flex justify-between">
          <span>Data e Huazimit: <strong>{format(new Date(form.loanDate), 'dd/MM/yyyy')}</strong></span>
          <span>Data e Kthimit: <strong>{format(new Date(form.returnDate), 'dd/MM/yyyy')}</strong></span>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="font-bold mb-2">Palët e Marrëveshjes:</h2>
        
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h3 className="font-bold">Huadhënësi:</h3>
            <div className="mt-2">
              <p><strong>Emri:</strong> BONEVET Gjakova</p>
              <p><strong>Adresa:</strong> Vëllezërit Frashëri, pn</p>
              <p><strong>NRB:</strong> 52003075</p>
              <p><strong>Email:</strong> gjakova@bonevet.org</p>
              <p><strong>Tel:</strong> +383 (0) 49 187 800</p>
            </div>
          </div>
          
          <div>
            <h3 className="font-bold">Huamarrësi:</h3>
            <div className="mt-2">
              <p><strong>Emri / Institucioni:</strong> {form.borrowerName}</p>
              <p><strong>Nr. Personal / NRB:</strong> {form.borrowerPersonalId}</p>
              {form.borrowerLegalRep && <p><strong>Përfaqësuesi ligjor:</strong> {form.borrowerLegalRep}</p>}
              <p><strong>Adresa:</strong> {form.borrowerAddress}</p>
              <p><strong>Nr. Tel.:</strong> {form.borrowerPhone}</p>
              <p><strong>Email:</strong> {form.borrowerEmail}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="font-bold mb-2">Pajisjet e Huazuara:</h2>
        
        <table className="w-full border-collapse border border-black">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-2 text-center w-12">Nr</th>
              <th className="border border-black p-2 text-left">Emri i pajisjes</th>
              <th className="border border-black p-2 text-left">Modeli/ID</th>
              <th className="border border-black p-2 text-center w-16">Sasia</th>
              <th className="border border-black p-2 text-left">Gjendja Fillestare</th>
            </tr>
          </thead>
          <tbody>
            {form.equipmentList.map((equipment, index) => (
              <tr key={index}>
                <td className="border border-black p-2 text-center">{index + 1}</td>
                <td className="border border-black p-2">{equipment.name}</td>
                <td className="border border-black p-2">{equipment.model}</td>
                <td className="border border-black p-2 text-center">{equipment.quantity}</td>
                <td className="border border-black p-2">{equipment.initialCondition}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-6">
        <h2 className="font-bold mb-2">Kushtet e Marrëveshjes:</h2>
        
        <ol className="list-decimal list-inside space-y-2">
          <li>Pajisjet duhet të kthehen në të njëjtën gjendje siç janë pranuar, sipas përshkrimit të gjendjes fillestare.</li>
          <li>Huamarrësi është përgjegjës për përdorimin e sigurt dhe mirëmbajtjen bazike të pajisjeve gjatë periudhës së huazimit.</li>
          <li>Pajisjet nuk mund të huazohen, transferohen apo jepen në përdorim tek persona të tretë pa pëlqimin me shkrim të BONEVET Gjakova.</li>
          <li>Në rast dëmtimi, humbjeje ose moskthimi, huamarrësi detyrohet të kompensojë dëmin:
            <ul className="list-disc list-inside ml-4 mt-1">
              <li>Me pajisje të njëjta ose të ngjashme, në gjendje të barasvlershme, ose</li>
              <li>Me kompensim financiar, në shumën e përcaktuar nga BONEVET Gjakova.</li>
            </ul>
          </li>
          <li>Afati i kthimit është i detyrueshëm. Për çdo ditë vonesë pa arsyetim të aprovuar me shkrim, huamarrësi i nënshtrohet një penaliteti prej <strong>{form.dailyPenalty} €</strong> në ditë.</li>
          <li>Pranim-dorëzimi i pajisjeve bëhet me procesverbal në momentin e kthimit.</li>
          <li>Marrëveshja hyn në fuqi ditën e nënshkrimit dhe mbetet valide deri në kthimin dhe verifikimin e gjendjes së pajisjeve.</li>
        </ol>
      </div>

      <div className="mb-6">
        <p>Çdo mosmarrëveshje që lind nga kjo marrëveshje do të zgjidhet fillimisht me mirëkuptim mes palëve, e në mungesë të saj, me anë të Gjykatës Themelore në Gjakovë.</p>
      </div>

      <div className="mt-8">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h3 className="font-bold">Përfaqësuesi i BONEVET Gjakova</h3>
            <div className="mt-4">
              <p>Emri: <strong>{form.bonevevRepresentativeName}</strong></p>
              <div className="mt-8 border-b border-black w-48">
                <p className="text-center mb-1">Nënshkrimi</p>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="font-bold">Huamarrësi</h3>
            <div className="mt-4">
              <p>Emri: <strong>{form.borrowerName}</strong></p>
              <div className="mt-8 border-b border-black w-48">
                <p className="text-center mb-1">Nënshkrimi</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}