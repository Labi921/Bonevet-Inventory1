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
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Wrench } from 'lucide-react';

interface DamagedItemManagementProps {
  itemId: number;
  itemName: string;
  quantityAvailable: number;
  quantityDamaged: number;
}

export default function DamagedItemManagement({ 
  itemId, 
  itemName, 
  quantityAvailable, 
  quantityDamaged 
}: DamagedItemManagementProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('damage');
  const [damageQuantity, setDamageQuantity] = useState(1);
  const [repairQuantity, setRepairQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const { toast } = useToast();

  const damageMutation = useMutation({
    mutationFn: async (data: { quantity: number; reason: string }) => {
      return apiRequest('POST', `/api/inventory/${itemId}/damage`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `${damageQuantity} unit(s) marked as damaged`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      queryClient.invalidateQueries({ queryKey: [`/api/inventory/${itemId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/stats'] });
      setDamageQuantity(1);
      setReason('');
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark item as damaged",
        variant: "destructive",
      });
    },
  });

  const repairMutation = useMutation({
    mutationFn: async (data: { quantity: number; reason: string }) => {
      return apiRequest('POST', `/api/inventory/${itemId}/repair`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `${repairQuantity} unit(s) returned to available stock`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      queryClient.invalidateQueries({ queryKey: [`/api/inventory/${itemId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/stats'] });
      setRepairQuantity(1);
      setReason('');
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to return item to stock",
        variant: "destructive",
      });
    },
  });

  const handleDamage = () => {
    if (damageQuantity <= 0 || damageQuantity > quantityAvailable) {
      toast({
        title: "Error",
        description: `Quantity must be between 1 and ${quantityAvailable}`,
        variant: "destructive",
      });
      return;
    }

    if (!reason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for marking item as damaged",
        variant: "destructive",
      });
      return;
    }

    damageMutation.mutate({ quantity: damageQuantity, reason: reason.trim() });
  };

  const handleRepair = () => {
    if (repairQuantity <= 0 || repairQuantity > quantityDamaged) {
      toast({
        title: "Error",
        description: `Quantity must be between 1 and ${quantityDamaged}`,
        variant: "destructive",
      });
      return;
    }

    if (!reason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for returning item to stock",
        variant: "destructive",
      });
      return;
    }

    repairMutation.mutate({ quantity: repairQuantity, reason: reason.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="justify-start text-orange-600 hover:text-orange-700"
        >
          <Wrench className="h-4 w-4 mr-2" />
          Process Damaged Item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Wrench className="h-5 w-5 text-orange-600 mr-2" />
            Damaged Item Management
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Item: {itemName}</h4>
            <div className="text-sm text-gray-600">
              <p>Available: {quantityAvailable}</p>
              <p>Damaged: {quantityDamaged}</p>
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="damage" className="flex items-center">
                <AlertTriangle className="h-4 w-4 mr-1" />
                Mark Damaged
              </TabsTrigger>
              <TabsTrigger value="repair" className="flex items-center">
                <Wrench className="h-4 w-4 mr-1" />
                Return to Stock
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="damage" className="space-y-4">
              <div>
                <Label htmlFor="damage-quantity" className="text-sm">
                  Quantity to mark as damaged:
                </Label>
                <Input
                  id="damage-quantity"
                  type="number"
                  min="1"
                  max={quantityAvailable}
                  value={damageQuantity}
                  onChange={(e) => setDamageQuantity(parseInt(e.target.value) || 1)}
                  className="mt-1"
                  disabled={quantityAvailable === 0}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available for damage: {quantityAvailable}
                </p>
              </div>
              
              <div>
                <Label htmlFor="damage-reason" className="text-sm">
                  Reason for damage:
                </Label>
                <Textarea
                  id="damage-reason"
                  placeholder="Describe the damage or issue..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={damageMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDamage}
                  disabled={damageMutation.isPending || quantityAvailable === 0}
                >
                  {damageMutation.isPending ? 'Processing...' : 'Mark as Damaged'}
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="repair" className="space-y-4">
              <div>
                <Label htmlFor="repair-quantity" className="text-sm">
                  Quantity to return to stock:
                </Label>
                <Input
                  id="repair-quantity"
                  type="number"
                  min="1"
                  max={quantityDamaged}
                  value={repairQuantity}
                  onChange={(e) => setRepairQuantity(parseInt(e.target.value) || 1)}
                  className="mt-1"
                  disabled={quantityDamaged === 0}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available for repair: {quantityDamaged}
                </p>
              </div>
              
              <div>
                <Label htmlFor="repair-reason" className="text-sm">
                  Repair notes:
                </Label>
                <Textarea
                  id="repair-reason"
                  placeholder="Describe the repair or resolution..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={repairMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRepair}
                  disabled={repairMutation.isPending || quantityDamaged === 0}
                >
                  {repairMutation.isPending ? 'Processing...' : 'Return to Stock'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}