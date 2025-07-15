import { pgTable, text, serial, integer, boolean, timestamp, real, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User Model
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("user"),
  active: boolean("active").notNull().default(true),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  email: true,
  role: true,
  active: true,
});

// Item Category Enum
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

// Inventory Item Model
export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  itemId: text("item_id").notNull().unique(), // BVGJK0001 format
  name: text("name").notNull(),
  model: text("model"),
  category: text("category").notNull(),
  status: text("status").notNull().default("Available"),
  location: text("location"),
  quantity: integer("quantity").notNull().default(1), // Total quantity registered
  quantityAvailable: integer("quantity_available").notNull().default(1), // Available for loan
  quantityLoaned: integer("quantity_loaned").notNull().default(0), // Currently loaned out
  quantityDamaged: integer("quantity_damaged").notNull().default(0), // Damaged/under repair
  price: real("price"),
  usage: text("usage").default("None"),
  notes: text("notes"),
  imagePath: text("image_path"), // Path to uploaded image
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItems)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    category: itemCategoryEnum,
    status: itemStatusEnum,
    usage: itemUsageEnum,
    itemId: z.string().optional(),
  });

// Loan Group Model (for grouping multiple items in one loan)
export const loanGroups = pgTable("loan_groups", {
  id: serial("id").primaryKey(),
  loanGroupId: text("loan_group_id").notNull().unique(), // LOAN-2025-001 format
  borrowerName: text("borrower_name").notNull(),
  borrowerType: text("borrower_type").notNull(), // Staff, Member, Other Organization
  borrowerContact: text("borrower_contact"),
  loanDate: date("loan_date").notNull(),
  expectedReturnDate: date("expected_return_date").notNull(),
  status: text("status").notNull().default("Ongoing"), // Ongoing, Returned, Overdue
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").notNull(),
});

// Loan Model (individual items in a loan group)
export const loans = pgTable("loans", {
  id: serial("id").primaryKey(),
  loanGroupId: integer("loan_group_id"), // Reference to loan_groups.id, made optional
  itemId: integer("item_id").notNull(),
  quantityLoaned: integer("quantity_loaned").notNull().default(1), // How many units of this item are loaned
  borrowerName: text("borrower_name"), // For individual loans (not in a group)
  borrowerType: text("borrower_type"), // Staff, Student, Other Organization, etc.
  borrowerContact: text("borrower_contact"),
  loanDate: timestamp("loan_date"), // Date when the item was loaned out
  expectedReturnDate: timestamp("expected_return_date"), // Expected return date
  actualReturnDate: date("actual_return_date"),
  status: text("status").notNull().default("Ongoing"), // Ongoing, Returned, Overdue
  notes: text("notes"),
  createdBy: integer("created_by"), // User who processed the loan
});

// Schema for creating a loan group with items
export const insertLoanGroupSchema = createInsertSchema(loanGroups)
  .omit({ id: true, loanGroupId: true, createdAt: true, status: true })
  .extend({
    createdBy: z.number().optional(), // Added by server
    items: z.array(z.number()).min(1, "At least one item must be selected"), // Array of item IDs
  });

// Schema for individual loan items (used internally)
export const insertLoanSchema = createInsertSchema(loans)
  .omit({ id: true, actualReturnDate: true, status: true })
  .extend({
    loanGroupId: z.number().optional(), // Make loanGroupId optional for individual loans
  });

// Document Model
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  documentId: text("document_id").notNull().unique(), // DOC-ACQ-2023-001
  type: text("type").notNull(), // Acquisition, Loan
  title: text("title").notNull(),
  relatedItemId: text("related_item_id"),
  content: text("content").notNull(),
  signedBy: text("signed_by").array(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").notNull(),
});

export const insertDocumentSchema = createInsertSchema(documents)
  .omit({ id: true, createdAt: true });

// Activity Log Model
export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(), // Item, Loan, Document, User
  entityId: text("entity_id").notNull(),
  details: text("details"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs)
  .omit({ id: true, timestamp: true });

// Type definitions
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;

export type LoanGroup = typeof loanGroups.$inferSelect;
export type InsertLoanGroup = z.infer<typeof insertLoanGroupSchema>;

export type Loan = typeof loans.$inferSelect;
export type InsertLoan = z.infer<typeof insertLoanSchema>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
