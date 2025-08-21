import { useQuery } from "@tanstack/react-query";
import {
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, Loader2 } from "lucide-react";

interface CategorySelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

interface Category {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
}

export function CategorySelect({ 
  value, 
  onValueChange, 
  placeholder = "Select category...",
  required = false 
}: CategorySelectProps) {
  // Fetch active categories from API
  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories/active'],
  });

  return (
    <FormItem>
      <FormLabel className="flex items-center gap-2">
        Category {required && <span className="text-red-500">*</span>}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Hover over categories to see descriptions</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </FormLabel>
      <Select value={value} onValueChange={onValueChange} required={required}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
        </FormControl>
        <SelectContent className="max-h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="ml-2 text-sm text-muted-foreground">Loading categories...</span>
            </div>
          ) : categories && categories.length > 0 ? (
            categories.map((category) => (
              <SelectItem 
                key={category.id} 
                value={category.name} 
                className="cursor-pointer py-3 px-4 hover:bg-accent focus:bg-accent"
              >
                <div className="flex flex-col items-start gap-1 w-full">
                  <span className="font-medium">{category.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {category.description}
                  </span>
                </div>
              </SelectItem>
            ))
          ) : (
            <div className="flex items-center justify-center py-4">
              <span className="text-sm text-muted-foreground">No categories available</span>
            </div>
          )}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  );
}