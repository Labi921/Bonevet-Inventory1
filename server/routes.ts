import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import MemoryStore from "memorystore";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  insertInventoryItemSchema, 
  insertLoanSchema,
  insertLoanGroupSchema,
  insertDocumentSchema,
  insertActivityLogSchema
} from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import multer from "multer";
import path from "path";

const Session = MemoryStore(session);

// Configure multer for file uploads
const storage_config = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/'); // Make sure this directory exists
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage_config,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded images
  app.use('/uploads', express.static('uploads'));
  
  // Session setup
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "bonevet-inventory-secret",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: process.env.NODE_ENV === "production" },
      store: new Session({
        checkPeriod: 86400000, // prune expired entries every 24h
      }),
    })
  );

  // Configure passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Passport strategy setup
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Invalid username" });
        }
        if (user.password !== password) { // In a real app, use proper password hashing
          return done(null, false, { message: "Invalid password" });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Authentication middleware
  const requireAuth = (req: Request, res: Response, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  // Admin middleware
  const requireAdmin = (req: Request, res: Response, next: any) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };

  // Error handling middleware for Zod validation
  const validateSchema = (schema: any) => {
    return (req: Request, res: Response, next: any) => {
      try {
        // Log the incoming request body for debugging
        console.log("Validating request body:", req.body);
        const result = schema.safeParse(req.body);
        
        if (!result.success) {
          const validationError = fromZodError(result.error);
          console.log("Validation error:", validationError);
          return res.status(400).json({ 
            message: "Validation error",
            errors: validationError.details
          });
        }
        
        // Replace the request body with the parsed data
        req.body = result.data;
        next();
      } catch (error) {
        console.error("Error during validation:", error);
        if (error instanceof ZodError) {
          const validationError = fromZodError(error);
          return res.status(400).json({ 
            message: "Validation error",
            errors: validationError.details
          });
        }
        next(error);
      }
    };
  };

  // Auth routes
  app.post("/api/auth/login", passport.authenticate("local"), (req, res) => {
    res.json({ user: req.user });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (req.isAuthenticated()) {
      res.json({ user: req.user });
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // User routes
  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.listUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", requireAdmin, validateSchema(insertUserSchema), async (req, res) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already taken" });
      }
      const user = await storage.createUser(req.body);
      
      // Log the activity
      await storage.createActivityLog({
        userId: (req.user as any).id,
        action: "Create",
        entityType: "User",
        entityId: user.id.toString(),
        details: `Created user: ${user.username}`
      });
      
      res.status(201).json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Inventory routes
  app.get("/api/inventory", requireAuth, async (req, res) => {
    try {
      const items = await storage.listInventoryItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch inventory items" });
    }
  });

  app.get("/api/inventory/stats", requireAuth, async (req, res) => {
    try {
      const counts = await storage.countInventoryItems();
      const categories = await storage.getInventoryItemsByCategory();
      res.json({ counts, categories });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch inventory stats" });
    }
  });

  app.get("/api/inventory/:id", requireAuth, async (req, res) => {
    try {
      const item = await storage.getInventoryItem(parseInt(req.params.id));
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch inventory item" });
    }
  });

  app.post("/api/inventory", requireAuth, upload.single('image'), async (req, res) => {
    try {
      // Convert form data fields to proper types
      const formData = { ...req.body };
      
      // Convert quantity to number
      if (formData.quantity) {
        formData.quantity = parseInt(formData.quantity);
      }
      
      // Convert price to number
      if (formData.price && formData.price !== '') {
        formData.price = parseFloat(formData.price);
      } else {
        delete formData.price; // Remove empty price field
      }
      
      // Validate the form data
      const validatedData = insertInventoryItemSchema.parse(formData);
      
      // Generate a unique BVGJK#### ID if not provided
      if (!validatedData.itemId) {
        const items = await storage.listInventoryItems();
        const lastId = items.length > 0 
          ? parseInt(items[items.length - 1].itemId.replace("BVGJK", "")) 
          : 0;
        validatedData.itemId = `BVGJK${String(lastId + 1).padStart(4, "0")}`;
      }
      
      // Add image path if uploaded
      if (req.file) {
        validatedData.imagePath = `/uploads/${req.file.filename}`;
      }
      
      const item = await storage.createInventoryItem(validatedData);
      
      // Log the activity
      await storage.createActivityLog({
        userId: (req.user as any).id,
        action: "Create",
        entityType: "InventoryItem",
        entityId: item.id.toString(),
        details: `Added item: ${item.name} (${item.itemId})`
      });
      
      res.status(201).json(item);
    } catch (error) {
      console.error('Error creating inventory item:', error);
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Failed to create inventory item" });
    }
  });

  app.put("/api/inventory/:id", requireAuth, upload.single('image'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existingItem = await storage.getInventoryItem(id);
      
      if (!existingItem) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      // Convert form data fields to proper types
      const updateData = { ...req.body };
      
      // Convert quantity to number
      if (updateData.quantity) {
        updateData.quantity = parseInt(updateData.quantity);
      }
      
      // Convert price to number
      if (updateData.price && updateData.price !== '') {
        updateData.price = parseFloat(updateData.price);
      } else if (updateData.price === '') {
        delete updateData.price; // Remove empty price field
      }
      
      // Add image path if uploaded
      if (req.file) {
        updateData.imagePath = `/uploads/${req.file.filename}`;
      }
      
      const updatedItem = await storage.updateInventoryItem(id, updateData);
      
      // Log the activity
      await storage.createActivityLog({
        userId: (req.user as any).id,
        action: "Update",
        entityType: "InventoryItem",
        entityId: id.toString(),
        details: `Updated item: ${existingItem.name} (${existingItem.itemId})`
      });
      
      res.json(updatedItem);
    } catch (error) {
      console.error('Error updating inventory item:', error);
      res.status(500).json({ message: "Failed to update inventory item" });
    }
  });

  app.delete("/api/inventory/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existingItem = await storage.getInventoryItem(id);
      
      if (!existingItem) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      await storage.deleteInventoryItem(id);
      
      // Log the activity
      await storage.createActivityLog({
        userId: (req.user as any).id,
        action: "Delete",
        entityType: "InventoryItem",
        entityId: id.toString(),
        details: `Deleted item: ${existingItem.name} (${existingItem.itemId})`
      });
      
      res.json({ message: "Item deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete inventory item" });
    }
  });

  // Partial delete inventory item
  app.post("/api/inventory/:id/partial-delete", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { quantityToDelete } = req.body;
      
      if (!quantityToDelete || quantityToDelete <= 0) {
        return res.status(400).json({ message: "Quantity to delete must be a positive number" });
      }
      
      const existingItem = await storage.getInventoryItem(id);
      if (!existingItem) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      if (quantityToDelete > existingItem.quantity) {
        return res.status(400).json({ message: "Cannot delete more items than available" });
      }
      
      const newQuantity = existingItem.quantity - quantityToDelete;
      
      if (newQuantity === 0) {
        // Delete the entire item if quantity becomes 0
        await storage.deleteInventoryItem(id);
        
        // Log the activity
        await storage.createActivityLog({
          userId: (req.user as any).id,
          action: "Delete",
          entityType: "InventoryItem",
          entityId: id.toString(),
          details: `Deleted all remaining ${quantityToDelete} unit(s) of ${existingItem.name} (${existingItem.itemId})`
        });
        
        res.json({ message: "Item deleted successfully" });
      } else {
        // Update the quantity
        const updatedItem = await storage.updateInventoryItem(id, { quantity: newQuantity });
        
        // Log the activity
        await storage.createActivityLog({
          userId: (req.user as any).id,
          action: "Update",
          entityType: "InventoryItem",
          entityId: id.toString(),
          details: `Deleted ${quantityToDelete} unit(s) of ${existingItem.name} (${existingItem.itemId}), ${newQuantity} remaining`
        });
        
        res.json(updatedItem);
      }
    } catch (error) {
      console.error('Error partially deleting inventory item:', error);
      res.status(500).json({ message: "Failed to delete inventory item" });
    }
  });

  // Mark item as damaged
  app.post("/api/inventory/:id/damage", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { quantity, reason } = req.body;
      
      if (!quantity || quantity <= 0) {
        return res.status(400).json({ message: "Quantity must be a positive number" });
      }
      
      const updatedItem = await storage.markItemDamaged(id, quantity);
      
      if (!updatedItem) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      // Log the activity
      await storage.createActivityLog({
        userId: (req.user as any).id,
        action: "Damage",
        entityType: "InventoryItem",
        entityId: id.toString(),
        details: `Marked ${quantity} unit(s) of ${updatedItem.name} as damaged${reason ? `: ${reason}` : ''}`
      });
      
      res.json(updatedItem);
    } catch (error) {
      console.error('Error marking item as damaged:', error);
      res.status(500).json({ message: error.message || "Failed to mark item as damaged" });
    }
  });

  // Mark item as repaired
  app.post("/api/inventory/:id/repair", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { quantity, reason } = req.body;
      
      if (!quantity || quantity <= 0) {
        return res.status(400).json({ message: "Quantity must be a positive number" });
      }
      
      const updatedItem = await storage.markItemRepaired(id, quantity);
      
      if (!updatedItem) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      // Log the activity
      await storage.createActivityLog({
        userId: (req.user as any).id,
        action: "Repair",
        entityType: "InventoryItem",
        entityId: id.toString(),
        details: `Returned ${quantity} unit(s) of ${updatedItem.name} to available stock${reason ? `: ${reason}` : ''}`
      });
      
      res.json(updatedItem);
    } catch (error) {
      console.error('Error marking item as repaired:', error);
      res.status(500).json({ message: error.message || "Failed to mark item as repaired" });
    }
  });

  // Update item lifecycle status
  app.post("/api/inventory/:id/lifecycle", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { lifecycleStatuses, lifecycleDate, lifecycleReason, quantityLifecycled } = req.body;
      
      if (!lifecycleStatuses || !Array.isArray(lifecycleStatuses) || lifecycleStatuses.length === 0) {
        return res.status(400).json({ message: "At least one lifecycle status must be selected" });
      }
      
      if (!lifecycleDate || !lifecycleReason) {
        return res.status(400).json({ message: "Lifecycle date and reason are required" });
      }
      
      if (!quantityLifecycled || quantityLifecycled <= 0) {
        return res.status(400).json({ message: "Quantity must be a positive number" });
      }
      
      const updatedItem = await storage.updateItemLifecycle(id, lifecycleStatuses, lifecycleDate, lifecycleReason, quantityLifecycled);
      
      if (!updatedItem) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      // Log the activity
      await storage.createActivityLog({
        userId: (req.user as any).id,
        action: "Lifecycle Update",
        entityType: "InventoryItem",
        entityId: id.toString(),
        details: `Updated lifecycle status for ${updatedItem.name}: ${quantityLifecycled} unit(s) - ${lifecycleStatuses.join(', ')} - ${lifecycleReason}`
      });
      
      res.json(updatedItem);
    } catch (error) {
      console.error('Error updating item lifecycle:', error);
      res.status(500).json({ message: error.message || "Failed to update item lifecycle" });
    }
  });

  // Get lifecycle history for an item
  app.get("/api/inventory/:id/lifecycle-history", requireAuth, async (req, res) => {
    try {
      const itemId = parseInt(req.params.id);
      const history = await storage.getLifecycleHistoryByItemId(itemId);
      res.json(history);
    } catch (error) {
      console.error('Error fetching lifecycle history:', error);
      res.status(500).json({ message: "Failed to fetch lifecycle history" });
    }
  });

  // Loan Group routes
  app.get("/api/loan-groups", requireAuth, async (req, res) => {
    try {
      const loanGroups = await storage.listLoanGroups();
      res.json(loanGroups);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch loan groups" });
    }
  });

  app.get("/api/loan-groups/recent", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const loanGroups = await storage.getRecentLoanGroups(limit);
      res.json(loanGroups);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent loan groups" });
    }
  });

  app.get("/api/loan-groups/:id", requireAuth, async (req, res) => {
    try {
      const loanGroup = await storage.getLoanGroup(parseInt(req.params.id));
      res.json(loanGroup);
    } catch (error) {
      res.status(404).json({ message: "Loan group not found" });
    }
  });

  app.post("/api/loan-groups", requireAuth, async (req, res) => {
    try {
      // Validate the loan group data (schema handles date transformation)
      const validatedData = insertLoanGroupSchema.parse(req.body);
      
      // Convert date strings to Date objects for storage
      const loanGroupData = {
        ...validatedData,
        loanDate: new Date(validatedData.loanDate),
        expectedReturnDate: new Date(validatedData.expectedReturnDate)
      };
      
      // Check if all items exist and are available with sufficient quantities
      const itemsData = validatedData.items;
      const unavailableItems = [];
      
      for (const itemData of itemsData) {
        const item = await storage.getInventoryItem(itemData.id);
        if (!item) {
          return res.status(404).json({ message: `Item with ID ${itemData.id} not found` });
        }
        
        if (item.quantityAvailable < itemData.quantity) {
          unavailableItems.push({
            id: item.id,
            name: item.name,
            itemId: item.itemId,
            requested: itemData.quantity,
            available: item.quantityAvailable
          });
        }
      }
      
      if (unavailableItems.length > 0) {
        return res.status(400).json({ 
          message: "Some items don't have sufficient quantity available for loan",
          unavailableItems
        });
      }
      
      // Create the loan group with quantities
      const loanGroup = await storage.createLoanGroup(
        { ...loanGroupData, createdBy: (req.user as any).id }, 
        itemsData
      );
      
      // Log the activity
      await storage.createActivityLog({
        userId: (req.user as any).id,
        action: "Create",
        entityType: "LoanGroup",
        entityId: loanGroup.id.toString(),
        details: `Created loan group with ${itemsData.length} items for ${loanGroup.borrowerName}`
      });
      
      res.status(201).json(loanGroup);
    } catch (error: any) {
      console.error("Error creating loan group:", error);
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Failed to create loan group", error: error?.message || "Unknown error" });
    }
  });

  app.put("/api/loan-groups/:id/return", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const loanGroup = await storage.getLoanGroup(id);
      
      if (loanGroup.status === "Returned") {
        return res.status(400).json({ message: "Loan group is already returned" });
      }
      
      const updatedLoanGroup = await storage.markLoanGroupReturned(id, new Date());
      
      // Log the activity
      await storage.createActivityLog({
        userId: (req.user as any).id,
        action: "Update",
        entityType: "LoanGroup",
        entityId: id.toString(),
        details: `Marked loan group as returned`
      });
      
      res.json(updatedLoanGroup);
    } catch (error) {
      res.status(500).json({ message: "Failed to update loan group" });
    }
  });

  // Individual Loan routes
  app.get("/api/loans", requireAuth, async (req, res) => {
    try {
      const allLoans = await storage.listLoans();
      
      // Filter out loans that are part of a loan group (multi-item loans)
      // We only want to show individual loans in the loans list
      const individualLoans = allLoans.filter(loan => loan.loanGroupId === null);
      
      // Enhance each loan with item name and ensure borrower information is available
      const enhancedLoans = await Promise.all(individualLoans.map(async (loan: any) => {
        // Get the inventory item to display more information
        const item = await storage.getInventoryItem(loan.itemId);
        
        // Add/enhance loan with needed information
        return {
          ...loan,
          // Display item information
          itemName: item ? `${item.itemId} - ${item.name}` : `Item #${loan.itemId}`,
          
          // Make sure borrower information is always available
          borrowerName: loan.borrowerName || "Unknown",
          borrowerType: loan.borrowerType || "Individual",
          borrowerContact: loan.borrowerContact || "",
          
          // Ensure date fields are properly formatted
          loanDate: loan.loanDate || new Date().toISOString(),
          expectedReturnDate: loan.expectedReturnDate || null
        };
      }));
      
      res.json(enhancedLoans);
    } catch (error) {
      console.error("Error fetching loans:", error);
      res.status(500).json({ message: "Failed to fetch loans" });
    }
  });

  app.get("/api/loans/recent", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const loans = await storage.getRecentLoans(limit);
      
      // Enhance loans with item names and complete borrower information
      const enhancedLoans = await Promise.all(loans.map(async (loan) => {
        // Get the inventory item to display more information
        const item = await storage.getInventoryItem(loan.itemId);
        
        // If this is a group loan, keep the group information
        if (loan.isGroupLoan && loan.loanGroupId) {
          return {
            ...loan,
            itemName: item ? item.name : `Item #${loan.itemId}`,
            // Group loans already have borrower info from the group
          };
        }
        
        // For individual loans, ensure borrower information is available
        if (!loan.borrowerName || loan.borrowerName === "Individual Loan") {
          // Try to get borrower info from the full loan record
          const loanRecord = await storage.getLoan(loan.id);
          if (loanRecord) {
            return {
              ...loan,
              itemName: item ? `${item.itemId} - ${item.name}` : `Item #${loan.itemId}`,
              borrowerName: loanRecord.borrowerName || "Unknown",
              borrowerType: loanRecord.borrowerType || "Individual",
              borrowerContact: loanRecord.borrowerContact || ""
            };
          }
        }
        
        // Return the loan with item name at minimum
        return {
          ...loan,
          itemName: item ? `${item.itemId} - ${item.name}` : `Item #${loan.itemId}`,
          borrowerName: loan.borrowerName || "Unknown",
          borrowerType: loan.borrowerType || "Individual"
        };
      }));
      
      res.json(enhancedLoans);
    } catch (error) {
      console.error("Error fetching recent loans:", error);
      res.status(500).json({ message: "Failed to fetch recent loans" });
    }
  });

  app.get("/api/loans/:id", requireAuth, async (req, res) => {
    try {
      const loan = await storage.getLoan(parseInt(req.params.id));
      if (!loan) {
        return res.status(404).json({ message: "Loan not found" });
      }
      res.json(loan);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch loan" });
    }
  });

  app.post("/api/loans", requireAuth, async (req, res) => {
    try {
      // Convert date strings to Date objects
      const loanData = { ...req.body };
      if (loanData.loanDate) {
        loanData.loanDate = new Date(loanData.loanDate);
      }
      if (loanData.expectedReturnDate) {
        loanData.expectedReturnDate = new Date(loanData.expectedReturnDate);
      }
      
      // Validate the loan data
      const validatedData = insertLoanSchema.parse(loanData);
      
      // Check if item exists and has sufficient quantity
      const itemId = validatedData.itemId;
      const quantityLoaned = validatedData.quantityLoaned || 1;
      const item = await storage.getInventoryItem(itemId);
      
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      // Check if there's enough quantity available (don't check status for quantity-based loans)
      if (item.quantityAvailable < quantityLoaned) {
        return res.status(400).json({ 
          message: `Insufficient quantity available. Requested: ${quantityLoaned}, Available: ${item.quantityAvailable}` 
        });
      }
      
      // Create the loan
      const loan = await storage.createLoan({
        ...validatedData,
        createdBy: (req.user as any).id
      });
      
      // Update inventory quantities (reduce available, increase loaned)
      await storage.updateItemQuantities(itemId, item.quantityLoaned + quantityLoaned, item.quantityDamaged);
      
      // Create a loan document
      const documentId = `DOC-LOAN-${new Date().getFullYear()}-${String(loan.id).padStart(3, "0")}`;
      await storage.createDocument({
        documentId,
        type: "Loan",
        title: `Loan Document for ${item.name}`,
        relatedItemId: item.itemId,
        content: JSON.stringify({
          itemDetails: item,
          loanDetails: loan
        }),
        signedBy: [],
        createdBy: (req.user as any).id
      });
      
      // Log the activity
      await storage.createActivityLog({
        userId: (req.user as any).id,
        action: "Create",
        entityType: "Loan",
        entityId: loan.id.toString(),
        details: `Created loan for: ${quantityLoaned} unit(s) of ${item.name} (${item.itemId}) to ${validatedData.borrowerName || 'Borrower'}`
      });
      
      res.status(201).json(loan);
    } catch (error) {
      console.error('Error creating loan:', error);
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Failed to create loan" });
    }
  });

  app.put("/api/loans/:id/return", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const loan = await storage.getLoan(id);
      
      if (!loan) {
        return res.status(404).json({ message: "Loan not found" });
      }
      
      if (loan.status === "Returned") {
        return res.status(400).json({ message: "Loan already marked as returned" });
      }
      
      const actualReturnDate = req.body.actualReturnDate 
        ? new Date(req.body.actualReturnDate) 
        : new Date();
      
      const updatedLoan = await storage.markLoanReturned(id, actualReturnDate);
      
      // Restore inventory quantities (increase available, decrease loaned)
      const item = await storage.getInventoryItem(loan.itemId);
      if (item) {
        const quantityReturned = loan.quantityLoaned || 1;
        await storage.updateItemQuantities(
          loan.itemId, 
          item.quantityLoaned - quantityReturned, 
          item.quantityDamaged
        );
      }
      
      // Log the activity
      await storage.createActivityLog({
        userId: (req.user as any).id,
        action: "Update",
        entityType: "Loan",
        entityId: id.toString(),
        details: `Marked loan as returned: ${loan.quantityLoaned || 1} unit(s) of item #${loan.itemId}`
      });
      
      res.json(updatedLoan);
    } catch (error) {
      res.status(500).json({ message: "Failed to update loan" });
    }
  });

  // Document routes
  app.get("/api/documents", requireAuth, async (req, res) => {
    try {
      const documents = await storage.listDocuments();
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.get("/api/documents/:id", requireAuth, async (req, res) => {
    try {
      const document = await storage.getDocument(parseInt(req.params.id));
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.json(document);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch document" });
    }
  });

  app.post("/api/documents", requireAuth, validateSchema(insertDocumentSchema), async (req, res) => {
    try {
      // Generate a unique document ID if not provided
      if (!req.body.documentId) {
        const documents = await storage.listDocuments();
        const docType = req.body.type === "Acquisition" ? "ACQ" : "MISC";
        const lastId = documents.length > 0 ? documents.length + 1 : 1;
        req.body.documentId = `DOC-${docType}-${new Date().getFullYear()}-${String(lastId).padStart(3, "0")}`;
      }
      
      const document = await storage.createDocument({
        ...req.body,
        createdBy: (req.user as any).id
      });
      
      // Log the activity
      await storage.createActivityLog({
        userId: (req.user as any).id,
        action: "Create",
        entityType: "Document",
        entityId: document.id.toString(),
        details: `Created document: ${document.title} (${document.documentId})`
      });
      
      res.status(201).json(document);
    } catch (error) {
      res.status(500).json({ message: "Failed to create document" });
    }
  });

  app.put("/api/documents/:id/sign", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const document = await storage.getDocument(id);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      const user = req.user as any;
      const signedBy = document.signedBy || [];
      
      // Check if user already signed
      if (signedBy.includes(user.name)) {
        return res.status(400).json({ message: "Document already signed by this user" });
      }
      
      // Add signature
      const updatedSignedBy = [...signedBy, user.name];
      const updatedDocument = await storage.updateDocument(id, { signedBy: updatedSignedBy });
      
      // Log the activity
      await storage.createActivityLog({
        userId: (req.user as any).id,
        action: "Update",
        entityType: "Document",
        entityId: id.toString(),
        details: `Signed document: ${document.title} (${document.documentId})`
      });
      
      res.json(updatedDocument);
    } catch (error) {
      res.status(500).json({ message: "Failed to sign document" });
    }
  });

  // Activity logs
  app.get("/api/activity", requireAuth, async (req, res) => {
    try {
      const logs = await storage.listActivityLogs();
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });

  app.get("/api/activity/recent", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const logs = await storage.getRecentActivityLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent activity logs" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
