import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { CalendarIcon, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { assetLifecycleStatusEnum } from '@shared/schema';

interface LifecycleManagementProps {
  itemId: number;
  itemName: string;
  quantityAvailable: number;
  currentLifecycleStatuses?: string[];
  currentLifecycleDate?: string;
  currentLifecycleReason?: string;
  currentQuantityLifecycled?: number;
}

export default function LifecycleManagement({ 
  itemId, 
  itemName, 
  quantityAvailable,
  currentLifecycleStatuses = [],
  currentLifecycleDate,
  currentLifecycleReason,
  currentQuantityLifecycled = 0
}: LifecycleManagementProps) {
  const [open, setOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(currentLifecycleStatuses);
  const [date, setDate] = useState<Date | undefined>(
    currentLifecycleDate ? new Date(currentLifecycleDate) : undefined
  );
  const [reason, setReason] = useState(currentLifecycleReason || '');
  const [quantity, setQuantity] = useState(1);
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const updateLifecycleMutation = useMutation({
    mutationFn: async (data: { 
      lifecycleStatuses: string[], 
      lifecycleDate: string, 
      lifecycleReason: string,
      quantityLifecycled: number
    }) => {
      return apiRequest('POST', `/api/inventory/${itemId}/lifecycle`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Item lifecycle updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update item lifecycle",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (status: string, checked: boolean) => {
    if (checked) {
      setSelectedStatuses([...selectedStatuses, status]);
    } else {
      setSelectedStatuses(selectedStatuses.filter(s => s !== status));
    }
  };

  const handleSubmit = () => {
    if (selectedStatuses.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one lifecycle status",
        variant: "destructive",
      });
      return;
    }
    
    if (!date) {
      toast({
        title: "Error",
        description: "Please select a date",
        variant: "destructive",
      });
      return;
    }
    
    if (!reason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason",
        variant: "destructive",
      });
      return;
    }
    
    if (quantity <= 0 || quantity > quantityAvailable) {
      toast({
        title: "Error",
        description: `Quantity must be between 1 and ${quantityAvailable}`,
        variant: "destructive",
      });
      return;
    }

    updateLifecycleMutation.mutate({
      lifecycleStatuses: selectedStatuses,
      lifecycleDate: format(date, 'yyyy-MM-dd'),
      lifecycleReason: reason.trim(),
      quantityLifecycled: quantity,
    });
  };

  const lifecycleOptions = assetLifecycleStatusEnum.options;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-purple-600 hover:text-purple-700">
          <Settings className="h-4 w-4 mr-1" />
          Lifecycle
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Asset Lifecycle Management</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Item: {itemName}</h4>
            <p className="text-sm text-gray-600">
              Update the lifecycle status for this item. You can select multiple statuses that apply.
            </p>
            <p className="text-sm text-blue-600 mt-1">
              Available quantity: {quantityAvailable} units
            </p>
          </div>
          
          <div className="space-y-3">
            <Label className="text-base font-medium">Lifecycle Status</Label>
            <div className="grid grid-cols-2 gap-3">
              {lifecycleOptions.map((status) => (
                <div key={status} className="flex items-center space-x-2">
                  <Checkbox
                    id={status}
                    checked={selectedStatuses.includes(status)}
                    onCheckedChange={(checked) => handleStatusChange(status, checked as boolean)}
                  />
                  <Label
                    htmlFor={status}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {status}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="text-base font-medium">Quantity</Label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              min={1}
              max={quantityAvailable}
              className="w-full"
              placeholder="Enter quantity"
            />
            <p className="text-xs text-gray-500">
              How many units of this item are going through lifecycle changes? (Max: {quantityAvailable})
            </p>
          </div>
          
          <div className="space-y-2">
            <Label className="text-base font-medium">Date</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(selectedDate) => {
                    setDate(selectedDate);
                    setCalendarOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="space-y-2">
            <Label className="text-base font-medium">Reason</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this lifecycle action is being taken..."
              className="min-h-[100px]"
            />
          </div>
          
          {currentLifecycleStatuses.length > 0 && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <h5 className="font-medium text-gray-900 mb-2">Current Lifecycle Status</h5>
              <div className="space-y-1">
                <p className="text-sm text-gray-600">
                  Status: {currentLifecycleStatuses.join(', ')}
                </p>
                {currentQuantityLifecycled > 0 && (
                  <p className="text-sm text-gray-600">
                    Quantity Lifecycled: {currentQuantityLifecycled} units
                  </p>
                )}
                {currentLifecycleDate && (
                  <p className="text-sm text-gray-600">
                    Date: {format(new Date(currentLifecycleDate), 'PPP')}
                  </p>
                )}
                {currentLifecycleReason && (
                  <p className="text-sm text-gray-600">
                    Reason: {currentLifecycleReason}
                  </p>
                )}
              </div>
            </div>
          )}
          
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={updateLifecycleMutation.isPending}
            >
              {updateLifecycleMutation.isPending ? 'Updating...' : 'Update Lifecycle'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}