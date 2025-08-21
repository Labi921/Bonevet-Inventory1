import { CATEGORY_DESCRIPTIONS, itemCategoryEnum } from "@shared/schema";
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
import { Info } from "lucide-react";

interface CategorySelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export function CategorySelect({ 
  value, 
  onValueChange, 
  placeholder = "Select category...",
  required = false 
}: CategorySelectProps) {
  const categories = itemCategoryEnum.options;

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
          {categories.map((category) => (
            <SelectItem 
              key={category} 
              value={category} 
              className="cursor-pointer py-3 px-4 hover:bg-accent focus:bg-accent"
            >
              <div className="flex flex-col items-start gap-1 w-full">
                <span className="font-medium">{category}</span>
                <span className="text-xs text-muted-foreground">
                  {CATEGORY_DESCRIPTIONS[category]}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  );
}