import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Trash } from 'lucide-react';

interface PartialDeleteDialogProps {
  itemId: number;
  itemName: string;
  totalQuantity: number;
  onComplete?: () => void;
}

export default function PartialDeleteDialog({ 
  itemId, 
  itemName, 
  totalQuantity, 
  onComplete 
}: PartialDeleteDialogProps) {
  const [open, setOpen] = useState(false);
  const [quantityToDelete, setQuantityToDelete] = useState(1);
  const [deleteAll, setDeleteAll] = useState(false);
  const { toast } = useToast();

  const partialDeleteMutation = useMutation({
    mutationFn: async (data: { quantityToDelete: number; deleteAll: boolean }) => {
      if (data.deleteAll) {
        return apiRequest('DELETE', `/api/inventory/${itemId}`);
      } else {
        return apiRequest('POST', `/api/inventory/${itemId}/partial-delete`, {
          quantityToDelete: data.quantityToDelete
        });
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: deleteAll ? "Item deleted successfully" : `${quantityToDelete} unit(s) removed from inventory`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      queryClient.invalidateQueries({ queryKey: [`/api/inventory/${itemId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/stats'] });
      setOpen(false);
      if (onComplete) onComplete();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete item",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (deleteAll) {
      if (confirm(`Are you sure you want to delete all ${totalQuantity} unit(s) of "${itemName}"? This action cannot be undone.`)) {
        partialDeleteMutation.mutate({ quantityToDelete: totalQuantity, deleteAll: true });
      }
    } else {
      if (quantityToDelete <= 0 || quantityToDelete > totalQuantity) {
        toast({
          title: "Error",
          description: `Quantity must be between 1 and ${totalQuantity}`,
          variant: "destructive",
        });
        return;
      }
      
      if (confirm(`Are you sure you want to delete ${quantityToDelete} unit(s) of "${itemName}"? This action cannot be undone.`)) {
        partialDeleteMutation.mutate({ quantityToDelete, deleteAll: false });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="justify-start text-red-600 hover:text-red-700"
        >
          <Trash className="h-4 w-4 mr-2" />
          Delete Item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            Delete Item
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Item: {itemName}</h4>
            <p className="text-sm text-gray-600">Total quantity: {totalQuantity}</p>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="partial-delete"
                name="delete-type"
                checked={!deleteAll}
                onChange={() => setDeleteAll(false)}
                className="text-red-600"
              />
              <Label htmlFor="partial-delete" className="text-sm">
                Delete specific quantity
              </Label>
            </div>
            
            {!deleteAll && (
              <div className="ml-6">
                <Label htmlFor="quantity" className="text-sm text-gray-600">
                  Quantity to delete:
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max={totalQuantity}
                  value={quantityToDelete}
                  onChange={(e) => setQuantityToDelete(parseInt(e.target.value) || 1)}
                  className="mt-1 w-24"
                />
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="delete-all"
                name="delete-type"
                checked={deleteAll}
                onChange={() => setDeleteAll(true)}
                className="text-red-600"
              />
              <Label htmlFor="delete-all" className="text-sm">
                Delete all {totalQuantity} unit(s)
              </Label>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={partialDeleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSubmit}
              disabled={partialDeleteMutation.isPending}
            >
              {partialDeleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}