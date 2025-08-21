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
        <SelectContent>
          {categories.map((category) => (
            <TooltipProvider key={category}>
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <SelectItem value={category} className="cursor-pointer">
                    {category}
                  </SelectItem>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-sm">{CATEGORY_DESCRIPTIONS[category]}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  );
}