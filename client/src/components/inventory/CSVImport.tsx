import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Download,
  Eye,
  Trash2
} from 'lucide-react';

interface CSVRow {
  itemId?: string;
  name: string;
  model?: string;
  category: string;
  status?: string;
  quantity?: number;
  price?: number;
  usage?: string;
  location?: string;
  notes?: string;
}

interface ValidationResult {
  valid: CSVRow[];
  errors: { row: number; errors: string[]; data: any }[];
}

export default function CSVImport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // Valid options for dropdown fields
  const validCategories = ["Furniture", "Equipment", "Tools", "Electronics", "Software", "Other"];
  const validStatuses = ["Available", "In Use", "Loaned Out", "Partially Available", "Damaged", "Maintenance"];
  const validUsages = ["None", "Staff", "Members", "Others"];

  // CSV Import mutation
  const importMutation = useMutation({
    mutationFn: async (data: CSVRow[]) => {
      const response = await fetch('/api/inventory/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: data }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to import inventory');
      }

      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: 'Import Successful',
        description: `Successfully imported ${result.imported} items. ${result.updated} updated, ${result.created} created.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      clearImport();
    },
    onError: (error: any) => {
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import inventory items.',
        variant: 'destructive',
      });
    },
  });

  // Parse CSV file
  const parseCSV = (text: string): CSVRow[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const data: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: any = {};

      headers.forEach((header, index) => {
        const value = values[index] || '';
        
        // Map CSV headers to our schema
        switch (header) {
          case 'item id':
          case 'itemid':
          case 'id':
            row.itemId = value;
            break;
          case 'name':
          case 'item name':
            row.name = value;
            break;
          case 'model':
            row.model = value;
            break;
          case 'category':
            row.category = value;
            break;
          case 'status':
            row.status = value || 'Available';
            break;
          case 'quantity':
          case 'qty':
            row.quantity = value ? parseInt(value) : 1;
            break;
          case 'price':
          case 'cost':
            row.price = value ? parseFloat(value.replace(/[$,]/g, '')) : undefined;
            break;
          case 'usage':
            row.usage = value || 'None';
            break;
          case 'location':
            row.location = value;
            break;
          case 'notes':
          case 'description':
            row.notes = value;
            break;
        }
      });

      if (row.name) {
        data.push(row);
      }
    }

    return data;
  };

  // Validate CSV data
  const validateData = (data: CSVRow[]): ValidationResult => {
    const valid: CSVRow[] = [];
    const errors: { row: number; errors: string[]; data: any }[] = [];

    data.forEach((row, index) => {
      const rowErrors: string[] = [];

      // Required fields
      if (!row.name || row.name.trim() === '') {
        rowErrors.push('Name is required');
      }

      if (!row.category || row.category.trim() === '') {
        rowErrors.push('Category is required');
      } else if (!validCategories.includes(row.category)) {
        rowErrors.push(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
      }

      // Optional field validation
      if (row.status && !validStatuses.includes(row.status)) {
        rowErrors.push(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }

      if (row.usage && !validUsages.includes(row.usage)) {
        rowErrors.push(`Invalid usage. Must be one of: ${validUsages.join(', ')}`);
      }

      if (row.quantity && (isNaN(row.quantity) || row.quantity < 1)) {
        rowErrors.push('Quantity must be a positive number');
      }

      if (row.price && (isNaN(row.price) || row.price < 0)) {
        rowErrors.push('Price must be a non-negative number');
      }

      if (rowErrors.length > 0) {
        errors.push({ row: index + 2, errors: rowErrors, data: row }); // +2 for header and 0-based index
      } else {
        valid.push(row);
      }
    });

    return { valid, errors };
  };

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: 'Invalid File Type',
        description: 'Please select a CSV file.',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);

    try {
      const text = await selectedFile.text();
      const parsed = parseCSV(text);
      setCsvData(parsed);
      
      const validation = validateData(parsed);
      setValidationResult(validation);

      toast({
        title: 'File Processed',
        description: `Found ${parsed.length} rows. ${validation.valid.length} valid, ${validation.errors.length} with errors.`,
      });
    } catch (error) {
      toast({
        title: 'Parse Error',
        description: 'Failed to parse CSV file. Please check the format.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Clear import data
  const clearImport = () => {
    setFile(null);
    setCsvData([]);
    setValidationResult(null);
    setImportProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Perform import
  const performImport = async () => {
    if (!validationResult?.valid.length) return;

    setImportProgress(0);
    
    // Simulate progress for user feedback
    const progressInterval = setInterval(() => {
      setImportProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      await importMutation.mutateAsync(validationResult.valid);
      setImportProgress(100);
    } finally {
      clearInterval(progressInterval);
    }
  };

  // Download sample CSV template
  const downloadTemplate = () => {
    const headers = [
      'name',
      'model',
      'category',
      'status',
      'quantity',
      'price',
      'usage',
      'location',
      'notes'
    ];

    const sampleData = [
      [
        'Sample Equipment',
        'Model X',
        'Electronics',
        'Available',
        '1',
        '299.99',
        'Staff',
        'Room 101',
        'Sample notes'
      ]
    ];

    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Import Inventory from CSV
        </CardTitle>
        <CardDescription>
          Upload a CSV file to bulk import or update inventory items
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Template Download */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div>
            <h4 className="font-medium">Need a template?</h4>
            <p className="text-sm text-muted-foreground">
              Download a sample CSV file with the correct format
            </p>
          </div>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </div>

        {/* File Upload */}
        <div className="space-y-4">
          <Label htmlFor="csv-file">Select CSV File</Label>
          <div className="flex items-center gap-4">
            <Input
              ref={fileInputRef}
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              disabled={isProcessing || importMutation.isPending}
            />
            {file && (
              <Button variant="outline" size="sm" onClick={clearImport}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Processing Indicator */}
        {isProcessing && (
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>Processing CSV file...</AlertDescription>
          </Alert>
        )}

        {/* Validation Results */}
        {validationResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {validationResult.valid.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Valid Items</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {validationResult.errors.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Errors</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {csvData.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Rows</div>
                </CardContent>
              </Card>
            </div>

            {/* Error Details */}
            {validationResult.errors.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">
                    {validationResult.errors.length} rows have errors:
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {validationResult.errors.slice(0, 5).map((error, index) => (
                      <div key={index} className="text-sm">
                        <strong>Row {error.row}:</strong> {error.errors.join(', ')}
                      </div>
                    ))}
                    {validationResult.errors.length > 5 && (
                      <div className="text-sm font-medium">
                        And {validationResult.errors.length - 5} more errors...
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Valid Items Preview */}
            {validationResult.valid.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Preview Valid Items ({validationResult.valid.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-64 overflow-y-auto">
                    <div className="space-y-2">
                      {validationResult.valid.slice(0, 10).map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex-1">
                            <div className="font-medium">{item.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {item.category} • Qty: {item.quantity || 1}
                              {item.model && ` • Model: ${item.model}`}
                            </div>
                          </div>
                          <Badge variant="outline">{item.status || 'Available'}</Badge>
                        </div>
                      ))}
                      {validationResult.valid.length > 10 && (
                        <div className="text-center text-sm text-muted-foreground py-2">
                          And {validationResult.valid.length - 10} more items...
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* Import Actions */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {validationResult.valid.length > 0 
                  ? `${validationResult.valid.length} items ready to import`
                  : 'Fix errors above to proceed with import'
                }
              </div>
              <Button
                onClick={performImport}
                disabled={validationResult.valid.length === 0 || importMutation.isPending}
                size="lg"
              >
                {importMutation.isPending ? 'Importing...' : 'Import Items'}
              </Button>
            </div>

            {/* Import Progress */}
            {importMutation.isPending && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Importing items...</span>
                  <span>{importProgress}%</span>
                </div>
                <Progress value={importProgress} className="w-full" />
              </div>
            )}
          </div>
        )}

        {/* Format Information */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium mb-2">CSV Format Requirements:</div>
            <ul className="text-sm space-y-1">
              <li>• <strong>Required:</strong> name, category</li>
              <li>• <strong>Optional:</strong> model, status, quantity, price, usage, location, notes</li>
              <li>• <strong>Categories:</strong> {validCategories.join(', ')}</li>
              <li>• <strong>Statuses:</strong> {validStatuses.join(', ')}</li>
              <li>• Items with existing Item IDs will be updated, new ones will be created</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}