import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Printer, QrCode, Search, FileCheck, Download, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface InventoryItem {
  id: number;
  itemId: string;
  name: string;
  model?: string;
  category: string;
  status: string;
  quantity: number;
  quantityAvailable: number;
  location?: string;
}

export default function Barcode() {
  const { toast } = useToast();
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [auditResults, setAuditResults] = useState<{
    found: InventoryItem[];
    missing: InventoryItem[];
    extra: string[];
  }>({ found: [], missing: [], extra: [] });
  const [isAuditMode, setIsAuditMode] = useState(false);
  
  const barcodePreviewRef = useRef<HTMLDivElement>(null);

  // Fetch inventory data
  const { data: inventory = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ['/api/inventory'],
    staleTime: 30000,
  });

  // Filter inventory items
  const filteredItems = inventory.filter((item) => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.itemId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.model?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = Array.from(new Set(inventory.map(item => item.category)));

  // Generate barcode for a single item
  const generateBarcode = (itemId: string, canvasId: string) => {
    try {
      JsBarcode(`#${canvasId}`, itemId, {
        format: "CODE128",
        width: 2,
        height: 40,
        displayValue: true,
        fontSize: 12,
        margin: 5,
      });
    } catch (error) {
      console.error('Error generating barcode:', error);
    }
  };

  // Generate barcodes for selected items in Avery 64x34mm format
  const generateBarcodeSheet = async () => {
    if (selectedItems.length === 0) {
      toast({
        title: 'No Items Selected',
        description: 'Please select at least one item to generate barcodes.',
        variant: 'destructive',
      });
      return;
    }

    const selectedInventory = inventory.filter(item => selectedItems.includes(item.id));
    
    // Create a temporary container for barcode generation
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.innerHTML = `
      <div id="barcode-sheet" style="
        width: 210mm; 
        height: 297mm; 
        padding: 15mm; 
        background: white;
        font-family: Arial, sans-serif;
        display: flex;
        flex-wrap: wrap;
        gap: 2mm;
        align-content: flex-start;
      ">
        ${selectedInventory.map((item, index) => `
          <div style="
            width: 64mm; 
            height: 34mm; 
            border: 1px solid #ddd;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2mm;
            box-sizing: border-box;
            page-break-inside: avoid;
          ">
            <canvas id="barcode-${index}" style="margin-bottom: 2px;"></canvas>
            <div style="
              font-size: 8px; 
              font-weight: bold; 
              text-align: center;
              line-height: 1.1;
              max-width: 100%;
              overflow: hidden;
            ">
              <div style="margin-bottom: 1px;">${item.name}</div>
              ${item.model ? `<div style="font-size: 7px; color: #666;">${item.model}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
    
    document.body.appendChild(container);

    // Generate individual barcodes
    selectedInventory.forEach((item, index) => {
      generateBarcode(item.itemId, `barcode-${index}`);
    });

    // Wait a bit for barcodes to render
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      // Convert to canvas and then PDF
      const element = document.getElementById('barcode-sheet');
      if (element) {
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        // A4 dimensions in mm
        const pageWidth = 210;
        const pageHeight = 297;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
        pdf.save(`barcodes-${new Date().toISOString().split('T')[0]}.pdf`);

        toast({
          title: 'Barcodes Generated',
          description: `PDF with ${selectedItems.length} barcodes has been downloaded.`,
        });
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Generation Failed',
        description: 'Failed to generate barcode PDF. Please try again.',
        variant: 'destructive',
      });
    } finally {
      // Clean up
      document.body.removeChild(container);
    }
  };

  // Handle barcode scanning for audit
  const handleScan = () => {
    if (!scannedBarcode.trim()) return;

    const foundItem = inventory.find(item => item.itemId === scannedBarcode.trim());
    
    if (foundItem) {
      // Check if already found
      const alreadyFound = auditResults.found.some(item => item.id === foundItem.id);
      
      if (!alreadyFound) {
        setAuditResults(prev => ({
          ...prev,
          found: [...prev.found, foundItem]
        }));
        toast({
          title: 'Item Found',
          description: `${foundItem.name} (${foundItem.itemId}) marked as present.`,
        });
      } else {
        toast({
          title: 'Already Scanned',
          description: `${foundItem.name} has already been scanned.`,
          variant: 'destructive',
        });
      }
    } else {
      // Check if this barcode was already marked as extra
      const alreadyExtra = auditResults.extra.includes(scannedBarcode.trim());
      
      if (!alreadyExtra) {
        setAuditResults(prev => ({
          ...prev,
          extra: [...prev.extra, scannedBarcode.trim()]
        }));
        toast({
          title: 'Unknown Barcode',
          description: `Barcode ${scannedBarcode} not found in inventory.`,
          variant: 'destructive',
        });
      }
    }
    
    setScannedBarcode('');
  };

  // Generate audit report
  const generateAuditReport = () => {
    const missing = inventory.filter(item => 
      !auditResults.found.some(found => found.id === item.id)
    );
    
    setAuditResults(prev => ({ ...prev, missing }));
    
    toast({
      title: 'Audit Complete',
      description: `Found: ${auditResults.found.length}, Missing: ${missing.length}, Extra: ${auditResults.extra.length}`,
    });
  };

  // Export audit report
  const exportAuditReport = () => {
    const report = {
      auditDate: new Date().toISOString(),
      summary: {
        totalItems: inventory.length,
        foundItems: auditResults.found.length,
        missingItems: auditResults.missing.length,
        extraItems: auditResults.extra.length
      },
      found: auditResults.found,
      missing: auditResults.missing,
      extra: auditResults.extra
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory-audit-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Report Exported',
      description: 'Audit report has been downloaded as JSON file.',
    });
  };

  const handleItemSelection = (itemId: number, checked: boolean) => {
    setSelectedItems(prev => 
      checked 
        ? [...prev, itemId]
        : prev.filter(id => id !== itemId)
    );
  };

  const selectAllItems = () => {
    setSelectedItems(filteredItems.map(item => item.id));
  };

  const clearSelection = () => {
    setSelectedItems([]);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Barcode System</h1>
          <p className="text-muted-foreground">Generate barcodes and perform inventory audits</p>
        </div>
      </div>

      <Tabs defaultValue="generate" className="w-full">
        <TabsList>
          <TabsTrigger value="generate" className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            Generate Barcodes
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            Inventory Audit
          </TabsTrigger>
        </TabsList>

        {/* Generate Barcodes Tab */}
        <TabsContent value="generate" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5" />
                Barcode Generation
              </CardTitle>
              <CardDescription>
                Select items to generate barcodes in Avery 64x34mm format for A4 paper
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Filter Controls */}
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label htmlFor="search">Search Items</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search by name, ID, or model..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="w-48">
                  <Label htmlFor="category">Category</Label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={selectAllItems}>
                    Select All ({filteredItems.length})
                  </Button>
                  <Button variant="outline" onClick={clearSelection}>
                    Clear ({selectedItems.length})
                  </Button>
                </div>
              </div>

              {/* Selected Items Summary */}
              {selectedItems.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {selectedItems.length} item(s) selected for barcode generation
                  </AlertDescription>
                </Alert>
              )}

              {/* Items List */}
              <div className="border rounded-lg max-h-96 overflow-y-auto">
                {filteredItems.map((item) => (
                  <div key={item.id} className="flex items-center space-x-3 p-3 border-b last:border-b-0 hover:bg-muted/50">
                    <Checkbox
                      checked={selectedItems.includes(item.id)}
                      onCheckedChange={(checked) => handleItemSelection(item.id, checked as boolean)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.name}</span>
                        <Badge variant="outline">{item.itemId}</Badge>
                        <Badge variant="secondary">{item.category}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.model && `Model: ${item.model} • `}
                        Status: {item.status} • Available: {item.quantityAvailable}/{item.quantity}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Generate Button */}
              <div className="flex justify-center">
                <Button
                  onClick={generateBarcodeSheet}
                  disabled={selectedItems.length === 0}
                  className="w-full max-w-md"
                  size="lg"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Generate Barcodes PDF ({selectedItems.length} items)
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Audit Tab */}
        <TabsContent value="audit" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Inventory Audit
              </CardTitle>
              <CardDescription>
                Scan barcodes to verify physical inventory matches system records
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Barcode Scanner Input */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="barcode-input">Scan or Enter Barcode</Label>
                  <Input
                    id="barcode-input"
                    placeholder="Scan barcode or type item ID..."
                    value={scannedBarcode}
                    onChange={(e) => setScannedBarcode(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleScan()}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleScan} disabled={!scannedBarcode.trim()}>
                    <Search className="h-4 w-4 mr-2" />
                    Scan
                  </Button>
                </div>
              </div>

              {/* Audit Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{inventory.length}</div>
                    <div className="text-sm text-muted-foreground">Total Items</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{auditResults.found.length}</div>
                    <div className="text-sm text-muted-foreground">Found</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">{auditResults.missing.length}</div>
                    <div className="text-sm text-muted-foreground">Missing</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">{auditResults.extra.length}</div>
                    <div className="text-sm text-muted-foreground">Extra</div>
                  </CardContent>
                </Card>
              </div>

              {/* Audit Results */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Found Items */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      Found Items ({auditResults.found.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-64 overflow-y-auto">
                    {auditResults.found.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No items scanned yet</p>
                    ) : (
                      <div className="space-y-2">
                        {auditResults.found.map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded">
                            <div>
                              <span className="font-medium">{item.name}</span>
                              <Badge variant="outline" className="ml-2">{item.itemId}</Badge>
                            </div>
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Missing Items */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <XCircle className="h-5 w-5" />
                      Missing Items ({auditResults.missing.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-64 overflow-y-auto">
                    {auditResults.missing.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">Complete audit to see missing items</p>
                    ) : (
                      <div className="space-y-2">
                        {auditResults.missing.map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded">
                            <div>
                              <span className="font-medium">{item.name}</span>
                              <Badge variant="outline" className="ml-2">{item.itemId}</Badge>
                            </div>
                            <XCircle className="h-4 w-4 text-red-600" />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Extra Items */}
              {auditResults.extra.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-600">
                      <AlertTriangle className="h-5 w-5" />
                      Extra/Unknown Barcodes ({auditResults.extra.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {auditResults.extra.map((barcode, index) => (
                        <Badge key={index} variant="destructive">{barcode}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Separator />

              {/* Action Buttons */}
              <div className="flex gap-4 justify-center">
                <Button
                  onClick={generateAuditReport}
                  variant="outline"
                  disabled={auditResults.found.length === 0}
                >
                  <FileCheck className="h-4 w-4 mr-2" />
                  Complete Audit
                </Button>
                <Button
                  onClick={exportAuditReport}
                  disabled={auditResults.found.length === 0 && auditResults.extra.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Report
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Hidden barcode preview container */}
      <div ref={barcodePreviewRef} className="hidden" />
    </div>
  );
}