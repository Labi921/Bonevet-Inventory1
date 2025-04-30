import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { PlusCircle, Download, Search, Filter, ListFilter } from 'lucide-react';
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
import ItemDetails from '@/components/inventory/ItemDetails';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Inventory() {
  const [location] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Check if we're on a sub-route
  const isAddItem = location === '/inventory/add';
  const isViewItem = location.startsWith('/inventory/view/');
  const itemId = isViewItem ? location.split('/inventory/view/')[1] : null;
  
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
  
  if (isAddItem) {
    return <AddItemForm />;
  }
  
  if (isViewItem && itemId) {
    return <ItemDetails id={itemId} />;
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
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0 mb-4">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Electronics">Electronics</SelectItem>
                <SelectItem value="Equipment">Equipment</SelectItem>
                <SelectItem value="Tools">Tools</SelectItem>
                <SelectItem value="Furniture">Furniture</SelectItem>
                <SelectItem value="Software">Software</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
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
