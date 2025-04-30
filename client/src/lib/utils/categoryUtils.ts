import { z } from "zod";

// Item Category Enum - matches the schema.ts definitions
export const itemCategoryEnum = z.enum([
  "Furniture",
  "Equipment",
  "Tools",
  "Electronics",
  "Software",
  "Other"
]);

// Item Status Enum
export const itemStatusEnum = z.enum([
  "Available",
  "In Use",
  "Loaned Out",
  "Damaged",
  "Maintenance"
]);

// Item Usage Enum
export const itemUsageEnum = z.enum([
  "None",
  "Staff",
  "Members",
  "Others"
]);

// Basic inventory item schema for forms
export const insertInventoryItemSchema = z.object({
  itemId: z.string().optional(),
  name: z.string().min(1, "Item name is required"),
  model: z.string().optional(),
  category: itemCategoryEnum,
  status: itemStatusEnum.default("Available"),
  location: z.string().optional(),
  quantity: z.number().int().positive("Quantity must be a positive integer").default(1),
  price: z.number().nonnegative("Price cannot be negative").optional(),
  usage: itemUsageEnum.default("None"),
  notes: z.string().optional(),
});

// Get color for status badge
export const getStatusColor = (status: string) => {
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

// Get Icon for category
export const getCategoryIcon = (category: string) => {
  // Return string identifiers instead of JSX to fix TypeScript/ESBuild error
  switch (category) {
    case 'Electronics':
      return 'electronics-icon';
    case 'Equipment':
      return 'equipment-icon';
    case 'Tools':
      return 'tools-icon';
    case 'Furniture':
      return 'furniture-icon';
    case 'Software':
      return 'software-icon';
    default:
      return 'other-icon';
  }
};

// Get next available item ID
export const getNextItemId = (items: any[]) => {
  if (!items || items.length === 0) {
    return 'BVGJK0001';
  }
  
  // Find the maximum item ID number
  const itemIds = items
    .map(item => item.itemId)
    .filter(id => id && id.startsWith('BVGJK'))
    .map(id => parseInt(id.replace('BVGJK', ''), 10));
    
  const maxId = Math.max(...itemIds, 0);
  
  // Generate the next ID with leading zeros
  return `BVGJK${String(maxId + 1).padStart(4, '0')}`;
};
