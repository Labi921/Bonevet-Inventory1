import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { PlusCircle, Download, Search, Filter, ListFilter, Upload, Settings, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import InventoryTable from '@/components/inventory/InventoryTable';
import AddItemForm from '@/components/inventory/AddItemForm';
import EditItemForm from '@/components/inventory/EditItemForm';
import ItemDetails from '@/components/inventory/ItemDetails';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Category {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
}

export default function Inventory() {
  const [location] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCategoryReference, setShowCategoryReference] = useState(false);

  // Fetch active categories
  const { data: categories } = useQuery<Category[]>({
    queryKey: ['/api/categories/active'],
  });
  
  // Check if we're on a sub-route
  const isAddItem = location === '/inventory/add';
  const isViewItem = location.startsWith('/inventory/view/');
  const isEditItem = location.startsWith('/inventory/edit/');
  const itemId = isViewItem ? location.split('/inventory/view/')[1] : null;
  const editItemId = isEditItem ? location.split('/inventory/edit/')[1] : null;
  
  // Fetch inventory items
  const { data: items, isLoading } = useQuery({
    queryKey: ['/api/inventory'],
  });
  
  // Filter items based on search term and filters
  const filteredItems = items ? items.filter((item: any) => {
    // Search term filter
    const matchesSearch = 
      (item.itemId && item.itemId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.name && item.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.model && item.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.location && item.location.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Category filter
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    
    // Status filter
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    
    return matchesSearch && matchesCategory && matchesStatus;
  }) : [];

  // Export inventory to CSV
  const handleExport = async () => {
    try {
      const response = await fetch('/api/inventory/export', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') 
        : `inventory-export-${new Date().toISOString().split('T')[0]}.csv`;

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting inventory:', error);
    }
  };
  
  if (isAddItem) {
    return <AddItemForm />;
  }
  
  if (isViewItem && itemId) {
    return <ItemDetails id={itemId} />;
  }
  
  if (isEditItem && editItemId) {
    return <EditItemForm id={editItemId} />;
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3">
        <CardTitle className="text-lg font-medium">Inventory Management</CardTitle>
        <div className="mt-3 sm:mt-0 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <Button asChild>
            <a href="/inventory/add">
              <PlusCircle className="h-4 w-4 mr-2" /> Add Item
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/inventory/import">
              <Upload className="h-4 w-4 mr-2" /> Import CSV
            </a>
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowCategoryReference(!showCategoryReference)}
            className="text-blue-600 hover:text-blue-700"
          >
            <Info className="h-4 w-4 mr-2" /> Category Reference
          </Button>
          <Button variant="outline" asChild>
            <a href="/inventory/categories">
              <Settings className="h-4 w-4 mr-2" /> Manage Categories
            </a>
          </Button>
        </div>
      </CardHeader>
      
      {/* Categories Reference Panel */}
      {showCategoryReference && (
        <CardContent className="border-b">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 flex items-center gap-2 mb-3">
              <Info className="h-4 w-4" />
              Available Categories for Import/Export
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories && categories.map((category) => (
                <div key={category.id} className="p-3 bg-white rounded border border-blue-200">
                  <div className="font-medium text-sm text-blue-900">{category.name}</div>
                  <div className="text-xs text-blue-600 mt-1">{category.description}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-200">
              <p className="text-sm text-yellow-800">
                <strong>For CSV Import/Export:</strong> Use these exact category names in your CSV files. 
                Category names are case-sensitive and must match exactly.
              </p>
            </div>
          </div>
        </CardContent>
      )}

      <CardContent>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0 mb-4">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories && categories.map((category) => (
                  <SelectItem key={category.id} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Available">Available</SelectItem>
                <SelectItem value="In Use">In Use</SelectItem>
                <SelectItem value="Loaned Out">Loaned Out</SelectItem>
                <SelectItem value="Damaged">Damaged</SelectItem>
                <SelectItem value="Maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search inventory..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <InventoryTable 
          items={filteredItems} 
          isLoading={isLoading} 
        />
      </CardContent>
    </Card>
  );
}
