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

const Session = MemoryStore(session);

export async function registerRoutes(app: Express): Promise<Server> {
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

  app.post("/api/inventory", requireAuth, validateSchema(insertInventoryItemSchema), async (req, res) => {
    try {
      // Generate a unique BVGJK#### ID if not provided
      if (!req.body.itemId) {
        const items = await storage.listInventoryItems();
        const lastId = items.length > 0 
          ? parseInt(items[items.length - 1].itemId.replace("BVGJK", "")) 
          : 0;
        req.body.itemId = `BVGJK${String(lastId + 1).padStart(4, "0")}`;
      }
      
      const item = await storage.createInventoryItem(req.body);
      
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
      res.status(500).json({ message: "Failed to create inventory item" });
    }
  });

  app.put("/api/inventory/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existingItem = await storage.getInventoryItem(id);
      
      if (!existingItem) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      const updatedItem = await storage.updateInventoryItem(id, req.body);
      
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

  app.post("/api/loan-groups", requireAuth, validateSchema(insertLoanGroupSchema), async (req, res) => {
    try {
      // Check if all items exist and are available
      const itemIds = req.body.items;
      const unavailableItems = [];
      
      for (const itemId of itemIds) {
        const item = await storage.getInventoryItem(itemId);
        if (!item) {
          return res.status(404).json({ message: `Item with ID ${itemId} not found` });
        }
        
        if (item.status !== "Available") {
          unavailableItems.push({
            id: item.id,
            name: item.name,
            itemId: item.itemId,
            status: item.status
          });
        }
      }
      
      if (unavailableItems.length > 0) {
        return res.status(400).json({ 
          message: "Some items are not available for loan",
          unavailableItems
        });
      }
      
      // Create the loan group
      const loanGroup = await storage.createLoanGroup(
        { ...req.body, createdBy: (req.user as any).id }, 
        itemIds
      );
      
      // Log the activity
      await storage.createActivityLog({
        userId: (req.user as any).id,
        action: "Create",
        entityType: "LoanGroup",
        entityId: loanGroup.id.toString(),
        details: `Created loan group with ${itemIds.length} items for ${loanGroup.borrowerName}`
      });
      
      res.status(201).json(loanGroup);
    } catch (error: any) {
      console.error("Error creating loan group:", error);
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
      
      // Fetch borrower information for each loan if needed
      const loansWithInfo = await Promise.all(individualLoans.map(async (loan: any) => {
        if (!loan.borrowerName) {
          // Get the inventory item to display more information
          const item = await storage.getInventoryItem(loan.itemId);
          return {
            ...loan,
            itemName: item ? item.name : `Item #${loan.itemId}`
          };
        }
        return loan;
      }));
      
      res.json(loansWithInfo);
    } catch (error) {
      console.error("Error fetching loans:", error);
      res.status(500).json({ message: "Failed to fetch loans" });
    }
  });

  app.get("/api/loans/recent", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const loans = await storage.getRecentLoans(limit);
      
      // Enhance individual loans with borrower information
      const enhancedLoans = await Promise.all(loans.map(async (loan) => {
        if (!loan.borrowerName || loan.borrowerName === "Individual Loan") {
          // This is an individual loan, get the borrower info from the loan record
          const loanRecord = await storage.getLoan(loan.id);
          if (loanRecord) {
            return {
              ...loan,
              borrowerName: loanRecord.borrowerName || "Unknown",
              borrowerType: loanRecord.borrowerType || "Individual"
            };
          }
        }
        return loan;
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

  app.post("/api/loans", requireAuth, validateSchema(insertLoanSchema), async (req, res) => {
    try {
      // Check if item exists and is available
      const itemId = req.body.itemId;
      const item = await storage.getInventoryItem(itemId);
      
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      if (item.status !== "Available") {
        return res.status(400).json({ message: "Item is not available for loan" });
      }
      
      // Create the loan
      const loan = await storage.createLoan({
        ...req.body,
        createdBy: (req.user as any).id
      });
      
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
        details: `Created loan for: ${item.name} (${item.itemId}) to ${req.body.borrowerName || 'Borrower'}`
      });
      
      res.status(201).json(loan);
    } catch (error) {
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
      
      // Log the activity
      await storage.createActivityLog({
        userId: (req.user as any).id,
        action: "Update",
        entityType: "Loan",
        entityId: id.toString(),
        details: `Marked loan as returned: ID ${id}`
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
