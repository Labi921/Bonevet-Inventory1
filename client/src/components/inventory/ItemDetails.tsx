import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  Edit, 
  Trash, 
  Handshake, 
  FileText,
  Package,
  MapPin,
  Tag,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface ItemDetailsProps {
  id: string;
}

export default function ItemDetails({ id }: ItemDetailsProps) {
  const [, navigate] = useLocation();
  
  // Define interface for item type
  interface InventoryItem {
    id: number;
    itemId: string;
    name: string;
    model?: string;
    category: string;
    status: string;
    location?: string;
    quantity: number;
    price?: number;
    usage: string;
    notes?: string;
    createdAt: string;
    updatedAt?: string;
  }

  // Fetch item details
  const { data: item, isLoading } = useQuery<InventoryItem>({
    queryKey: [`/api/inventory/${id}`],
  });
  
  // Handle edit item
  const handleEditItem = () => {
    navigate(`/inventory/edit/${id}`);
  };
  
  // Handle loan item
  const handleLoanItem = () => {
    navigate(`/loans/new?itemId=${id}`);
  };
  
  // Handle delete item
  const handleDeleteItem = () => {
    // Implement delete functionality
  };
  
  // Get status badge class
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Available':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'In Use':
        return 'bg-amber-100 text-amber-800 hover:bg-amber-200';
      case 'Loaned Out':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
      case 'Damaged':
        return 'bg-red-100 text-red-800 hover:bg-red-200';
      case 'Maintenance':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/inventory')}
            className="w-fit mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Inventory
          </Button>
          <div className="h-8 w-64 bg-gray-200 animate-pulse rounded"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:space-x-6">
              <div className="md:w-1/3 space-y-4">
                <div className="h-40 bg-gray-200 animate-pulse rounded-md"></div>
                <div className="space-y-2">
                  <div className="h-6 w-24 bg-gray-200 animate-pulse rounded"></div>
                  <div className="h-10 w-full bg-gray-200 animate-pulse rounded"></div>
                </div>
              </div>
              <div className="md:w-2/3 mt-6 md:mt-0 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="space-y-1">
                      <div className="h-5 w-20 bg-gray-200 animate-pulse rounded"></div>
                      <div className="h-6 w-full bg-gray-200 animate-pulse rounded"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!item) {
    return (
      <Card>
        <CardHeader>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/inventory')}
            className="w-fit mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Inventory
          </Button>
          <CardTitle>Item Not Found</CardTitle>
        </CardHeader>
        <CardContent>
          <p>The requested item could not be found. It may have been deleted or you may not have permission to view it.</p>
          <Button onClick={() => navigate('/inventory')} className="mt-4">
            Return to Inventory
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/inventory')}
          className="w-fit mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Inventory
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between">
          <CardTitle className="text-xl">{item.name}</CardTitle>
          <Badge className={getStatusBadgeClass(item.status)}>{item.status}</Badge>
        </div>
        <p className="text-sm text-gray-500">{item.itemId} • {item.model}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:space-x-6">
            <div className="md:w-1/3 space-y-4">
              <div className="aspect-square bg-gray-100 rounded-md flex items-center justify-center">
                <div className="h-24 w-24 rounded-md bg-primary-100 flex items-center justify-center text-primary-800">
                  {/* Use Package icon for all categories */}
                  <Package className="h-16 w-16" />
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Actions</h3>
                  <div className="mt-2 flex flex-col space-y-2">
                    <Button 
                      variant="outline" 
                      className="justify-start" 
                      onClick={handleEditItem}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Item
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="justify-start text-amber-600 hover:text-amber-700" 
                      disabled={item.status !== 'Available'}
                      onClick={handleLoanItem}
                    >
                      <Handshake className="h-4 w-4 mr-2" />
                      Process Loan
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="justify-start text-red-600 hover:text-red-700" 
                      onClick={handleDeleteItem}
                    >
                      <Trash className="h-4 w-4 mr-2" />
                      Delete Item
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="justify-start" 
                      onClick={() => navigate('/documents/new?type=Acquisition&itemId=' + item.id)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Document
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="md:w-2/3 mt-6 md:mt-0">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium">Item Details</h3>
                  <Separator className="my-2" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Category</p>
                      <div className="mt-1 flex items-center">
                        <Tag className="h-4 w-4 mr-2 text-gray-400" />
                        <p>{item.category}</p>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-gray-500">Location</p>
                      <div className="mt-1 flex items-center">
                        <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                        <p>{item.location || 'Not specified'}</p>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-gray-500">Quantity</p>
                      <p className="mt-1">{item.quantity || 1}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-gray-500">Price</p>
                      <p className="mt-1">{item.price ? `€${item.price.toFixed(2)}` : 'Not specified'}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-gray-500">In Use Of</p>
                      <p className="mt-1">{item.usage}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-gray-500">Added on</p>
                      <div className="mt-1 flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                        <p>{format(new Date(item.createdAt), 'PP')}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {item.notes && (
                  <div>
                    <h3 className="text-lg font-medium">Notes</h3>
                    <Separator className="my-2" />
                    <p className="mt-2 text-gray-600 whitespace-pre-line">{item.notes}</p>
                  </div>
                )}
                
                {/* Activity History (if implemented) */}
                <div>
                  <h3 className="text-lg font-medium">Activity History</h3>
                  <Separator className="my-2" />
                  <div className="mt-2 space-y-3">
                    <div className="flex items-start">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          Item added to inventory
                        </p>
                        <p className="text-sm text-gray-500">
                          {format(new Date(item.createdAt), 'PPpp')}
                        </p>
                      </div>
                    </div>
                    
                    {item.updatedAt && item.updatedAt !== item.createdAt && (
                      <div className="flex items-start">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            Item information updated
                          </p>
                          <p className="text-sm text-gray-500">
                            {format(new Date(item.updatedAt), 'PPpp')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
