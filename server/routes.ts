import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import MemoryStore from "memorystore";
import { storage } from "./storage";
import type { InventoryItem } from "../shared/schema";
import { 
  insertUserSchema, 
  insertInventoryItemSchema, 
  insertLoanSchema,
  insertLoanGroupSchema,
  insertDocumentSchema,
  insertActivityLogSchema,
  insertCategorySchema,
  insertResourceSchema,
  userRoleEnum,
  passwordResetRequestSchema,
  passwordResetSchema
} from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { hashPassword, comparePassword, validatePasswordStrength } from "./utils/passwordUtils";

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

// Separate multer configuration for PDF uploads in resources
const uploadPDF = multer({ 
  storage: storage_config,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for PDFs
  fileFilter: (req, file, cb) => {
    const filetypes = /pdf/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = /application\/pdf/.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
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
        
        // Use bcrypt to compare the password securely
        const isValidPassword = await comparePassword(password, user.password);
        if (!isValidPassword) {
          return done(null, false, { message: "Invalid password" });
        }
        
        return done(null, user);
      } catch (err) {
        console.error("Error during authentication:", err);
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
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = req.user as any;
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };

  // Super Admin middleware
  const requireSuperAdmin = (req: Request, res: Response, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = req.user as any;
    if (!user || user.role !== "superadmin") {
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

  // Password Reset Routes
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = passwordResetRequestSchema.parse(req.body);
      
      // Check if user exists
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not for security
        return res.json({ message: "If your email is registered, you will receive a password reset link." });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Save reset token
      await storage.createPasswordResetToken({
        token: resetToken,
        userId: user.id,
        expiresAt,
        used: false
      });

      // TODO: Send email with reset link
      // For now, we'll just log it (in production, integrate with email service)
      console.log(`Password reset link for ${email}: http://localhost:5000/reset-password?token=${resetToken}`);

      res.json({ message: "If your email is registered, you will receive a password reset link." });
    } catch (error) {
      console.error("Error in forgot-password:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = passwordResetSchema.parse(req.body);
      
      // Find and validate token
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      // Check if token is expired or used
      if (resetToken.used || new Date() > resetToken.expiresAt) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      // Get user
      const user = await storage.getUser(resetToken.userId);
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({ 
          message: "Password does not meet security requirements",
          errors: passwordValidation.errors
        });
      }
      
      // Hash the new password before storing
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(user.id, { password: hashedPassword });
      
      // Mark token as used
      await storage.markPasswordResetTokenUsed(resetToken.id);

      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        action: "Password Reset",
        entityType: "User",
        entityId: user.id.toString(),
        details: "Password was reset using email verification"
      });

      res.json({ message: "Password reset successfully. You can now log in with your new password." });
    } catch (error) {
      console.error("Error in reset-password:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/auth/me", (req, res) => {
    if (req.isAuthenticated()) {
      res.json({ user: req.user });
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // User Management middleware - Admin and Super Admin can manage users
  const requireUserManagement = (req: Request, res: Response, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = req.user as any;
    if (!user || !['admin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };

  // User routes (Admin and Super Admin)
  app.get("/api/users", requireUserManagement, async (req, res) => {
    try {
      const users = await storage.listUsers();
      res.json(users.map(user => ({ ...user, password: undefined })));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", requireUserManagement, validateSchema(insertUserSchema), async (req, res) => {
    try {
      const currentUser = req.user as any;
      const requestedRole = req.body.role;
      
      // Check role creation permissions:
      // - Admin can create: admin, standard_user, staff_user
      // - Super Admin can create: any role including superadmin
      if (currentUser.role === 'admin' && requestedRole === 'superadmin') {
        return res.status(403).json({ message: "Admin users cannot create Super Admin accounts" });
      }
      
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already taken" });
      }
      
      // Check for duplicate email
      const existingEmail = await storage.getUserByEmail(req.body.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email address already in use" });
      }
      
      // Validate password strength
      const passwordValidation = validatePasswordStrength(req.body.password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({ 
          message: "Password does not meet security requirements",
          errors: passwordValidation.errors
        });
      }
      
      // Hash the password before storing
      const hashedPassword = await hashPassword(req.body.password);
      const userData = { ...req.body, password: hashedPassword };
      const user = await storage.createUser(userData);
      
      // Log the activity
      await storage.createActivityLog({
        userId: currentUser.id,
        action: "Create",
        entityType: "User",
        entityId: user.id.toString(),
        details: `Created user: ${user.username}`
      });
      
      res.status(201).json({ ...user, password: undefined });
    } catch (error: any) {
      console.error("Error creating user:", error);
      
      // Handle database constraint violations
      if (error.code === '23505') {
        if (error.constraint === 'users_email_unique') {
          return res.status(400).json({ message: "Email address already in use" });
        }
        if (error.constraint === 'users_username_unique') {
          return res.status(400).json({ message: "Username already taken" });
        }
      }
      
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Add PUT and DELETE routes for users
  app.put("/api/users/:id", requireUserManagement, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentUser = req.user as any;
      const validatedData = insertUserSchema.partial().parse(req.body);
      
      // Check role modification permissions:
      // - Admin can modify: admin, standard_user, staff_user
      // - Super Admin can modify: any role including superadmin
      if (validatedData.role === 'superadmin' && currentUser.role === 'admin') {
        return res.status(403).json({ message: "Admin users cannot create or modify Super Admin accounts" });
      }
      
      // Get the target user to check if they're trying to modify a Super Admin
      const targetUser = await storage.getUser(id);
      if (targetUser && targetUser.role === 'superadmin' && currentUser.role === 'admin') {
        return res.status(403).json({ message: "Admin users cannot modify Super Admin accounts" });
      }
      
      // If password is being updated, hash it securely
      if (validatedData.password) {
        // Validate password strength
        const passwordValidation = validatePasswordStrength(validatedData.password);
        if (!passwordValidation.isValid) {
          return res.status(400).json({ 
            message: "Password does not meet security requirements",
            errors: passwordValidation.errors
          });
        }
        
        // Hash the new password
        validatedData.password = await hashPassword(validatedData.password);
      }
      
      const user = await storage.updateUser(id, validatedData);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ ...user, password: undefined });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireUserManagement, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentUser = req.user as any;
      
      // Get the target user to check if they're trying to delete a Super Admin
      const targetUser = await storage.getUser(id);
      if (targetUser && targetUser.role === 'superadmin' && currentUser.role === 'admin') {
        return res.status(403).json({ message: "Admin users cannot delete Super Admin accounts" });
      }
      
      const success = await storage.deleteUser(id);
      
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Standard User and above middleware for resources
  const requireStandardUserOrAbove = (req: Request, res: Response, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = req.user as any;
    if (!user || !['standard_user', 'staff_user', 'admin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };

  // Resource Management Routes
  app.get("/api/resources", requireAuth, async (req, res) => {
    try {
      const type = req.query.type as string;
      let resources;
      
      if (type) {
        resources = await storage.listResourcesByType(type);
      } else {
        resources = await storage.listResources();
      }
      
      res.json(resources);
    } catch (error) {
      console.error("Error fetching resources:", error);
      res.status(500).json({ message: "Failed to fetch resources" });
    }
  });

  app.post("/api/resources", requireAdmin, uploadPDF.single('pdfFile'), async (req, res) => {
    try {
      const user = req.user as any;
      const resourceData = { ...req.body, uploadedBy: user.id };
      
      // Parse tags if it's a JSON string
      if (resourceData.tags && typeof resourceData.tags === 'string') {
        try {
          resourceData.tags = JSON.parse(resourceData.tags);
        } catch (e) {
          // If parsing fails, convert to array
          resourceData.tags = [resourceData.tags];
        }
      } else if (!resourceData.tags || resourceData.tags === '') {
        // Set empty array if no tags
        resourceData.tags = [];
      }
      
      // Add file path if PDF uploaded
      if (req.file) {
        resourceData.fileUrl = `/uploads/${req.file.filename}`;
      }
      
      const validatedData = insertResourceSchema.parse(resourceData);
      const resource = await storage.createResource(validatedData);
      res.status(201).json(resource);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error creating resource:", error);
      res.status(500).json({ message: "Failed to create resource" });
    }
  });

  app.put("/api/resources/:id", requireAdmin, uploadPDF.single('pdfFile'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = { ...req.body };
      
      // Parse tags if it's a JSON string
      if (updateData.tags && typeof updateData.tags === 'string') {
        try {
          updateData.tags = JSON.parse(updateData.tags);
        } catch (e) {
          // If parsing fails, convert to array
          updateData.tags = [updateData.tags];
        }
      }
      
      // Add file path if PDF uploaded
      if (req.file) {
        updateData.fileUrl = `/uploads/${req.file.filename}`;
      }
      
      const validatedData = insertResourceSchema.partial().parse(updateData);
      const resource = await storage.updateResource(id, validatedData);
      
      if (!resource) {
        return res.status(404).json({ message: "Resource not found" });
      }
      
      res.json(resource);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      console.error("Error updating resource:", error);
      res.status(500).json({ message: "Failed to update resource" });
    }
  });

  app.delete("/api/resources/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteResource(id);
      
      if (!success) {
        return res.status(404).json({ message: "Resource not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting resource:", error);
      res.status(500).json({ message: "Failed to delete resource" });
    }
  });

  // Resource Categories API Routes
  app.get('/api/resource-categories', requireAuth, async (req, res) => {
    try {
      const categories = await storage.listActiveResourceCategories();
      res.json(categories);
    } catch (error) {
      console.error('Error fetching resource categories:', error);
      res.status(500).json({ message: 'Failed to fetch resource categories' });
    }
  });

  app.get('/api/resource-categories/all', requireAdmin, async (req, res) => {
    try {
      const categories = await storage.listResourceCategories();
      res.json(categories);
    } catch (error) {
      console.error('Error fetching all resource categories:', error);
      res.status(500).json({ message: 'Failed to fetch resource categories' });
    }
  });

  app.post('/api/resource-categories', requireAdmin, async (req, res) => {
    try {
      const categoryData = req.body;
      const category = await storage.createResourceCategory(categoryData);
      res.status(201).json(category);
    } catch (error: any) {
      console.error('Error creating resource category:', error);
      
      // Handle duplicate name constraint
      if (error.code === '23505' && error.constraint === 'resource_categories_name_unique') {
        return res.status(400).json({ 
          message: `Category "${req.body.name}" already exists. Please choose a different name.` 
        });
      }
      
      res.status(500).json({ message: 'Failed to create resource category' });
    }
  });

  app.put('/api/resource-categories/:id', requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid category ID' });
    }

    try {
      const categoryData = req.body;
      const category = await storage.updateResourceCategory(id, categoryData);
      
      if (!category) {
        return res.status(404).json({ message: 'Resource category not found' });
      }

      res.json(category);
    } catch (error) {
      console.error('Error updating resource category:', error);
      res.status(500).json({ message: 'Failed to update resource category' });
    }
  });

  app.delete('/api/resource-categories/:id', requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid category ID' });
    }

    try {
      const success = await storage.deleteResourceCategory(id);
      if (!success) {
        return res.status(404).json({ message: 'Resource category not found' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting resource category:', error);
      res.status(500).json({ message: 'Failed to delete resource category' });
    }
  });

  app.put('/api/resource-categories/:id/reorder', requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const { direction } = req.body;
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid category ID' });
    }

    if (!direction || !['up', 'down'].includes(direction)) {
      return res.status(400).json({ message: 'Invalid direction. Must be "up" or "down"' });
    }

    try {
      const success = await storage.reorderResourceCategory(id, direction);
      if (!success) {
        return res.status(404).json({ message: 'Resource category not found' });
      }
      res.json({ message: 'Category reordered successfully' });
    } catch (error) {
      console.error('Error reordering resource category:', error);
      res.status(500).json({ message: 'Failed to reorder resource category' });
    }
  });

  // Resource Attachments API Routes (for multiple videos/PDFs in trainings)
  app.get('/api/resources/:resourceId/attachments', requireAuth, async (req, res) => {
    const resourceId = parseInt(req.params.resourceId);
    if (isNaN(resourceId)) {
      return res.status(400).json({ message: 'Invalid resource ID' });
    }

    try {
      const attachments = await storage.getResourceAttachments(resourceId);
      res.json(attachments);
    } catch (error) {
      console.error('Error fetching resource attachments:', error);
      res.status(500).json({ message: 'Failed to fetch attachments' });
    }
  });

  app.post('/api/resources/:resourceId/attachments', requireAdmin, async (req, res) => {
    const resourceId = parseInt(req.params.resourceId);
    if (isNaN(resourceId)) {
      return res.status(400).json({ message: 'Invalid resource ID' });
    }

    try {
      const attachmentData = { ...req.body, resourceId };
      const attachment = await storage.createResourceAttachment(attachmentData);
      res.status(201).json(attachment);
    } catch (error: any) {
      console.error('Error creating resource attachment:', error);
      res.status(500).json({ message: 'Failed to create attachment' });
    }
  });

  app.put('/api/resource-attachments/:id', requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid attachment ID' });
    }

    try {
      const attachmentData = req.body;
      const attachment = await storage.updateResourceAttachment(id, attachmentData);
      
      if (!attachment) {
        return res.status(404).json({ message: 'Resource attachment not found' });
      }

      res.json(attachment);
    } catch (error) {
      console.error('Error updating resource attachment:', error);
      res.status(500).json({ message: 'Failed to update attachment' });
    }
  });

  app.delete('/api/resource-attachments/:id', requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid attachment ID' });
    }

    try {
      const success = await storage.deleteResourceAttachment(id);
      if (!success) {
        return res.status(404).json({ message: 'Resource attachment not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting resource attachment:', error);
      res.status(500).json({ message: 'Failed to delete attachment' });
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

  // Export route - must come before the :id route to avoid conflicts
  app.get("/api/inventory/export", requireAuth, async (req, res) => {
    try {
      const items = await storage.listInventoryItems();
      
      // Generate CSV content
      const headers = [
        'Item ID',
        'Name',
        'Model',
        'Category',
        'Status',
        'Quantity Total',
        'Quantity Available',
        'Quantity Loaned',
        'Quantity Damaged',
        'Unit Price',
        'Usage',
        'Location',
        'Notes',
        'Created Date'
      ];
      
      const csvRows = [
        headers.join(','),
        ...items.map(item => [
          item.itemId || '',
          `"${(item.name || '').replace(/"/g, '""')}"`,
          `"${(item.model || '').replace(/"/g, '""')}"`,
          item.category || '',
          item.status || '',
          item.quantity || 0,
          item.quantityAvailable || 0,
          item.quantityLoaned || 0,
          item.quantityDamaged || 0,
          item.unitPrice ? `€${item.unitPrice.toFixed(2)}` : '',
          item.usage || '',
          `"${(item.location || '').replace(/"/g, '""')}"`,
          `"${(item.notes || '').replace(/"/g, '""')}"`,
          item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''
        ].join(','))
      ];
      
      // Add UTF-8 BOM for proper encoding of special characters like €
      const csvContent = '\uFEFF' + csvRows.join('\n');
      const filename = `inventory-export-${new Date().toISOString().split('T')[0]}.csv`;
      
      // Set headers for file download with UTF-8 encoding
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8'));
      
      // Log the activity
      await storage.createActivityLog({
        userId: (req.user as any).id,
        action: "Export",
        entityType: "InventoryItem",
        entityId: "bulk",
        details: `Exported ${items.length} inventory items to CSV`
      });
      
      res.send(csvContent);
    } catch (error) {
      console.error('Error exporting inventory:', error);
      res.status(500).json({ message: "Failed to export inventory" });
    }
  });

  // CSV Import endpoint
  app.post("/api/inventory/import", requireAuth, async (req, res) => {
    try {
      const { items } = req.body;
      
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "No items provided for import" });
      }

      let created = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const item of items) {
        try {
          // Debug log the incoming item data
          console.log('Processing CSV item:', JSON.stringify(item, null, 2));
          // Check if item exists by itemId or name
          const existingItems = await storage.listInventoryItems();
          let existingItem = null;
          
          if (item.itemId) {
            existingItem = existingItems.find(inv => inv.itemId === item.itemId);
          }
          
          if (!existingItem && item.name) {
            existingItem = existingItems.find(inv => inv.name.toLowerCase() === item.name.toLowerCase());
          }

          if (existingItem) {
            // Update existing item
            // Ensure quantity is properly converted to number
            const quantity = typeof item.quantity === 'string' ? parseInt(item.quantity) : item.quantity;
            const finalQuantity = quantity && quantity > 0 ? quantity : existingItem.quantity;
            
            const updateData = {
              ...item,
              id: existingItem.id,
              itemId: existingItem.itemId, // Keep original itemId
              quantity: finalQuantity,
              quantityAvailable: finalQuantity
            };
            
            await storage.updateInventoryItem(existingItem.id, updateData);
            updated++;
            
            // Log the activity
            await storage.createActivityLog({
              userId: (req.user as any).id,
              action: "Update",
              entityType: "InventoryItem",
              entityId: existingItem.id.toString(),
              details: `Updated item via CSV import: ${item.name}`
            });
          } else {
            // Create new item
            // Generate itemId if not provided
            if (!item.itemId) {
              const lastId = existingItems.length > 0 
                ? Math.max(...existingItems.map(inv => parseInt(inv.itemId.replace("BVGJK", "")) || 0))
                : 0;
              item.itemId = `BVGJK${String(lastId + 1).padStart(4, "0")}`;
            }
            
            // Ensure quantity is properly converted to number
            const quantity = typeof item.quantity === 'string' ? parseInt(item.quantity) : item.quantity;
            const finalQuantity = quantity && quantity > 0 ? quantity : 1;
            
            const newItem = await storage.createInventoryItem({
              ...item,
              quantity: finalQuantity,
              quantityAvailable: finalQuantity,
              quantityLoaned: 0,
              quantityDamaged: 0,
              status: item.status || "Available",
              usage: item.usage || "None"
            });
            
            created++;
            
            // Log the activity
            await storage.createActivityLog({
              userId: (req.user as any).id,
              action: "Create",
              entityType: "InventoryItem",
              entityId: newItem.id.toString(),
              details: `Created item via CSV import: ${item.name} (${item.itemId})`
            });
          }
        } catch (itemError) {
          console.error(`Error processing item ${item.name}:`, itemError);
          errors.push(`Failed to process "${item.name}": ${itemError instanceof Error ? itemError.message : 'Unknown error'}`);
        }
      }

      // Log the bulk import activity
      await storage.createActivityLog({
        userId: (req.user as any).id,
        action: "Import",
        entityType: "InventoryItem",
        entityId: "bulk",
        details: `CSV Import completed: ${created} created, ${updated} updated, ${errors.length} errors`
      });

      res.json({
        imported: created + updated,
        created,
        updated,
        errors: errors.length,
        errorDetails: errors
      });
    } catch (error) {
      console.error('Error during CSV import:', error);
      res.status(500).json({ message: "Failed to import inventory items" });
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
      
      // Convert unitPrice to number
      if (formData.unitPrice && formData.unitPrice !== '') {
        formData.unitPrice = parseFloat(formData.unitPrice);
      } else {
        delete formData.unitPrice; // Remove empty unitPrice field
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
      
      // Convert unitPrice to number
      if (updateData.unitPrice && updateData.unitPrice !== '') {
        updateData.unitPrice = parseFloat(updateData.unitPrice);
      } else if (updateData.unitPrice === '') {
        delete updateData.unitPrice; // Remove empty unitPrice field
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
        loanGroupData, 
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

  // Barcode API endpoints
  app.get("/api/inventory/barcode/:itemId", requireAuth, async (req, res) => {
    try {
      const itemId = req.params.itemId;
      const item = await storage.getInventoryItemByItemId(itemId);
      
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      res.json({
        found: true,
        item: {
          id: item.id,
          itemId: item.itemId,
          name: item.name,
          model: item.model,
          category: item.category,
          status: item.status,
          location: item.location
        }
      });
    } catch (error) {
      console.error('Error finding item by barcode:', error);
      res.status(500).json({ message: "Failed to lookup barcode" });
    }
  });

  // Generate inventory audit report
  app.post("/api/inventory/audit", requireAuth, async (req, res) => {
    try {
      const { scannedItems, extraBarcodes } = req.body;
      
      if (!Array.isArray(scannedItems)) {
        return res.status(400).json({ message: "Invalid scanned items data" });
      }
      
      const allItems = await storage.listInventoryItems();
      const foundItemIds = scannedItems.map(item => item.id);
      const missingItems = allItems.filter(item => !foundItemIds.includes(item.id));
      
      const auditReport = {
        auditDate: new Date().toISOString(),
        auditedBy: (req.user as any).id,
        summary: {
          totalItems: allItems.length,
          foundItems: scannedItems.length,
          missingItems: missingItems.length,
          extraItems: extraBarcodes ? extraBarcodes.length : 0
        },
        found: scannedItems,
        missing: missingItems,
        extra: extraBarcodes || []
      };

      // Log the audit activity
      await storage.createActivityLog({
        userId: (req.user as any).id,
        action: "Audit",
        entityType: "Inventory",
        entityId: "AUDIT-" + new Date().toISOString().split('T')[0],
        details: `Completed inventory audit: Found ${scannedItems.length}/${allItems.length} items, ${missingItems.length} missing, ${extraBarcodes?.length || 0} extra`
      });
      
      res.json(auditReport);
    } catch (error) {
      console.error('Error generating audit report:', error);
      res.status(500).json({ message: "Failed to generate audit report" });
    }
  });

  // Export loans to CSV
  app.get("/api/loans/export", requireAuth, async (req, res) => {
    try {
      const [individualLoans, loanGroups] = await Promise.all([
        storage.listLoans(),
        storage.listLoanGroups()
      ]);
      
      // Generate CSV content for all loans
      const headers = [
        'Type',
        'ID',
        'Item ID/Group ID',
        'Item Name',
        'Borrower Name',
        'Borrower Contact',
        'Loan Date',
        'Expected Return',
        'Actual Return',
        'Status',
        'Notes'
      ];
      
      const csvRows = [headers.join(',')];
      
      // Add individual loans
      individualLoans.forEach(loan => {
        const inventory = Array.from(storage.inventoryItems.values()).find(item => item.id === loan.itemId);
        csvRows.push([
          'Individual',
          loan.id || '',
          loan.itemId || '',
          `"${(inventory?.name || 'Unknown Item').replace(/"/g, '""')}"`,
          `"${(loan.borrowerName || '').replace(/"/g, '""')}"`,
          `"${(loan.borrowerContact || '').replace(/"/g, '""')}"`,
          loan.loanDate ? new Date(loan.loanDate).toLocaleDateString() : '',
          loan.expectedReturnDate ? new Date(loan.expectedReturnDate).toLocaleDateString() : '',
          loan.actualReturnDate ? new Date(loan.actualReturnDate).toLocaleDateString() : '',
          loan.status || '',
          `"${(loan.notes || '').replace(/"/g, '""')}"`
        ].join(','));
      });
      
      // Add loan groups
      loanGroups.forEach(group => {
        const itemNames = Array.isArray(group.items) 
          ? group.items.map(item => {
              const inventory = Array.from(storage.inventoryItems.values()).find(inv => inv.id === item.itemId);
              return inventory?.name || 'Unknown Item';
            }).join('; ')
          : 'Multiple Items';
        
        csvRows.push([
          'Multi-Item',
          group.id || '',
          group.loanGroupId || '',
          `"${itemNames.replace(/"/g, '""')}"`,
          `"${(group.borrowerName || '').replace(/"/g, '""')}"`,
          `"${(group.borrowerContact || '').replace(/"/g, '""')}"`,
          group.loanDate ? new Date(group.loanDate).toLocaleDateString() : '',
          group.expectedReturnDate ? new Date(group.expectedReturnDate).toLocaleDateString() : '',
          group.returnDate ? new Date(group.returnDate).toLocaleDateString() : '',
          group.status || '',
          `"${(group.notes || '').replace(/"/g, '""')}"`
        ].join(','));
      });
      
      const csvContent = csvRows.join('\n');
      const filename = `loans-export-${new Date().toISOString().split('T')[0]}.csv`;
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', Buffer.byteLength(csvContent));
      
      // Log the activity
      await storage.createActivityLog({
        userId: (req.user as any).id,
        action: "Export",
        entityType: "Loan",
        entityId: "bulk",
        details: `Exported ${individualLoans.length + loanGroups.length} loan records to CSV`
      });
      
      res.send(csvContent);
    } catch (error) {
      console.error('Error exporting loans:', error);
      res.status(500).json({ message: "Failed to export loans" });
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
      
      // Create the loan (storage now handles quantity updates automatically)
      const loan = await storage.createLoan({
        ...validatedData,
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
        signedBy: []
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
      
      // Mark loan as returned (storage now handles quantity updates automatically)
      const updatedLoan = await storage.markLoanReturned(id, actualReturnDate);
      
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

  // Category Management Routes
  app.get("/api/categories", requireAuth, async (req, res) => {
    try {
      const categories = await storage.listCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.get("/api/categories/active", requireAuth, async (req, res) => {
    try {
      const categories = await storage.listActiveCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching active categories:", error);
      res.status(500).json({ message: "Failed to fetch active categories" });
    }
  });

  app.post("/api/categories", requireAuth, async (req, res) => {
    try {
      const categoryData = insertCategorySchema.parse(req.body);
      
      // Check if category already exists
      const existingCategory = await storage.getCategoryByName(categoryData.name);
      if (existingCategory) {
        return res.status(400).json({ message: "Category with this name already exists" });
      }
      
      const category = await storage.createCategory(categoryData);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  // IMPORTANT: Place reorder route BEFORE the :id route to avoid parameter conflicts
  app.put("/api/categories/reorder", requireAuth, async (req, res) => {
    try {
      const { categoryIds } = req.body;
      if (!Array.isArray(categoryIds)) {
        return res.status(400).json({ message: "categoryIds must be an array" });
      }
      
      // Validate that all items are numbers
      if (!categoryIds.every(id => typeof id === 'number')) {
        return res.status(400).json({ message: "All category IDs must be numbers" });
      }
      
      const reorderedCategories = await storage.reorderCategories(categoryIds);
      res.json(reorderedCategories);
    } catch (error) {
      console.error("Error reordering categories:", error);
      res.status(500).json({ message: "Failed to reorder categories" });
    }
  });

  app.put("/api/categories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const categoryData = insertCategorySchema.parse(req.body);
      
      // Check if another category with this name exists (excluding current one)
      const existingCategory = await storage.getCategoryByName(categoryData.name);
      if (existingCategory && existingCategory.id !== id) {
        return res.status(400).json({ message: "Category with this name already exists" });
      }
      
      const category = await storage.updateCategory(id, categoryData);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error updating category:", error);
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteCategory(id);
      if (!deleted) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json({ message: "Category deleted successfully" });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });




  // Loan Agreement Generation endpoint
  // Loan Agreement PDF Download endpoint
  app.get('/api/loan-agreement/:documentId/download', requireAuth, async (req, res) => {
    try {
      const { documentId } = req.params;
      
      // Get document from storage
      const documents = await storage.listDocuments();
      const document = documents.find(doc => doc.id.toString() === documentId);
      if (!document || document.type !== 'Loan Agreement') {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Parse document content
      const agreementData = JSON.parse(document.content);
      
      // Use PDFKit for better PDF generation
      const PDFDocument = (await import('pdfkit')).default;
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      
      // Collect PDF data in buffer
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      
      // Generate Albanian loan agreement PDF to match HTML preview exactly
      const margin = 50;
      const pageWidth = 595; // A4 width in points
      const contentWidth = pageWidth - (margin * 2);
      const leftColumn = margin;
      const rightColumn = margin + (contentWidth / 2);
      
      // Header - exact match to HTML
      doc.fontSize(16).font('Helvetica-Bold')
         .text('MARRËVESHJE PËR HUAZIM TË PAJISJEVE', { align: 'center' });
      doc.moveDown(1.2);
      
      // Dates section (like HTML: Data e Huazimit and Data e Kthimit)
      doc.fontSize(11).font('Helvetica');
      const dateY = doc.y;
      doc.text(`Data e Huazimit: ${agreementData.loanDate}`, leftColumn, dateY);
      doc.text(`Data e Kthimit: ${agreementData.returnDate}`, rightColumn, dateY);
      doc.moveDown(1.5);
      
      // Contracting parties section - exact match to HTML grid layout
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Palët e Marrëveshjes:', leftColumn);
      doc.moveDown(0.8);
      
      const partiesY = doc.y;
      
      // Left column - BONEVET (Huadhënësi)
      doc.font('Helvetica-Bold').fontSize(11);
      doc.text('Huadhënësi:', leftColumn, partiesY);
      doc.moveDown(0.5);
      
      doc.font('Helvetica').fontSize(10);
      doc.text('Emri: BONEVET Gjakova', leftColumn);
      doc.text('Adresa: Vëllezërit Frashëri, pn', leftColumn);
      doc.text('NRB: 52003075', leftColumn);
      doc.text('Email: gjakova@bonevet.org', leftColumn);
      doc.text('Tel: +383 (0) 49 187 800', leftColumn);
      
      // Right column - Borrower (Huamarrësi)
      doc.font('Helvetica-Bold').fontSize(11);
      doc.text('Huamarrësi:', rightColumn, partiesY);
      doc.moveDown(0.5);
      
      doc.font('Helvetica').fontSize(10);
      doc.text(`Emri / Institucioni: ${agreementData.borrowerName}`, rightColumn, partiesY + 18);
      doc.text(`Nr. Personal / NRB: ${agreementData.borrowerPersonalId}`, rightColumn);
      if (agreementData.borrowerLegalRep) {
        doc.text(`Përfaqësuesi ligjor: ${agreementData.borrowerLegalRep}`, rightColumn);
      }
      doc.text(`Adresa: ${agreementData.borrowerAddress}`, rightColumn);
      doc.text(`Nr. Tel.: ${agreementData.borrowerPhone}`, rightColumn);
      doc.text(`Email: ${agreementData.borrowerEmail}`, rightColumn);
      
      doc.moveDown(2.5);
      
      // Equipment Table - exact match to HTML table
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Pajisjet e Huazuara:', leftColumn);
      doc.moveDown(0.8);
      
      // Table with borders (simulating HTML table structure)
      const tableStartY = doc.y;
      const rowHeight = 20;
      const colWidths = [40, 140, 100, 50, 165];
      const colX = [
        leftColumn,
        leftColumn + colWidths[0],
        leftColumn + colWidths[0] + colWidths[1],
        leftColumn + colWidths[0] + colWidths[1] + colWidths[2],
        leftColumn + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3]
      ];
      
      // Table header with background (gray)
      doc.rect(leftColumn, tableStartY, contentWidth, rowHeight).fillAndStroke('#f3f4f6', '#000');
      doc.fillColor('#000').font('Helvetica-Bold').fontSize(9);
      
      const headerY = tableStartY + 6;
      doc.text('Nr', colX[0] + 5, headerY);
      doc.text('Emri i pajisjes', colX[1] + 5, headerY);
      doc.text('Modeli/ID', colX[2] + 5, headerY);
      doc.text('Sasia', colX[3] + 5, headerY);
      doc.text('Gjendja Fillestare', colX[4] + 5, headerY);
      
      // Table rows
      doc.font('Helvetica').fontSize(9);
      let currentRowY = tableStartY + rowHeight;
      
      agreementData.equipmentList.forEach((item: any, index: number) => {
        // Draw row background and borders
        doc.rect(leftColumn, currentRowY, contentWidth, rowHeight).stroke();
        
        const textY = currentRowY + 6;
        doc.text(`${index + 1}`, colX[0] + 5, textY);
        doc.text(item.name.substring(0, 25), colX[1] + 5, textY); // Truncate if too long
        doc.text(item.model.substring(0, 15), colX[2] + 5, textY);
        doc.text(item.quantity.toString(), colX[3] + 15, textY);
        doc.text(item.initialCondition.substring(0, 28), colX[4] + 5, textY);
        
        currentRowY += rowHeight;
      });
      
      doc.y = currentRowY + 20;
      
      // Terms and Conditions - exact match to HTML ordered list
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Kushtet e Marrëveshjes:', leftColumn);
      doc.moveDown(0.8);
      
      doc.font('Helvetica').fontSize(10);
      const terms = [
        '1. Pajisjet duhet të kthehen në të njëjtën gjendje siç janë pranuar, sipas përshkrimit të gjendjes fillestare.',
        '2. Huamarrësi është përgjegjës për përdorimin e sigurt dhe mirëmbajtjen bazike të pajisjeve gjatë periudhës së huazimit.',
        '3. Pajisjet nuk mund të huazohen, transferohen apo jepen në përdorim tek persona të tretë pa pëlqimin me shkrim të BONEVET Gjakova.',
        '4. Në rast dëmtimi, humbjeje ose moskthimi, huamarrësi detyrohet të kompensojë dëmin:\n    • Me pajisje të njëjta ose të ngjashme, në gjendje të barasvlershme, ose\n    • Me kompensim financiar, në shumën e përcaktuar nga BONEVET Gjakova.',
        `5. Afati i kthimit është i detyrueshëm. Për çdo ditë vonesë pa arsyetim të aprovuar me shkrim, huamarrësi i nënshtrohet një penaliteti prej ${agreementData.dailyPenalty} € në ditë.`,
        '6. Pranim-dorëzimi i pajisjeve bëhet me procesverbal në momentin e kthimit.',
        '7. Marrëveshja hyn në fuqi ditën e nënshkrimit dhe mbetet valide deri në kthimin dhe verifikimin e gjendjes së pajisjeve.'
      ];
      
      terms.forEach(term => {
        doc.text(term, { width: contentWidth, align: 'justify' });
        doc.moveDown(0.4);
      });
      
      doc.moveDown(0.8);
      
      // Additional clause
      doc.text('Çdo mosmarrëveshje që lind nga kjo marrëveshje do të zgjidhet fillimisht me mirëkuptim mes palëve, e në mungesë të saj, me anë të Gjykatës Themelore në Gjakovë.', 
               { width: contentWidth, align: 'justify' });
      
      doc.moveDown(2);
      
      // Signatures section - exact match to HTML grid layout
      const signatureY = doc.y;
      
      // Left signature - BONEVET Representative
      doc.font('Helvetica-Bold').fontSize(11);
      doc.text('Përfaqësuesi i BONEVET Gjakova', leftColumn, signatureY);
      doc.font('Helvetica').fontSize(10);
      doc.text(`Emri: ${agreementData.bonevevRepresentativeName}`, leftColumn, signatureY + 20);
      doc.text('_________________________', leftColumn, signatureY + 60);
      doc.text('Nënshkrimi', leftColumn + 60, signatureY + 80);
      
      // Right signature - Borrower
      doc.font('Helvetica-Bold').fontSize(11);
      doc.text('Huamarrësi', rightColumn, signatureY);
      doc.font('Helvetica').fontSize(10);
      doc.text(`Emri: ${agreementData.borrowerName}`, rightColumn, signatureY + 20);
      doc.text('_________________________', rightColumn, signatureY + 60);
      doc.text('Nënshkrimi', rightColumn + 60, signatureY + 80);
      
      // Finish the PDF
      doc.end();
      
      // Create promise to wait for PDF completion
      const pdfBuffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => {
          resolve(Buffer.concat(buffers));
        });
      });

      
      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Loan_Agreement_${documentId}.pdf"`);
      res.send(pdfBuffer);
      
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      res.status(500).json({ message: 'Failed to generate PDF' });
    }
  });

  app.post("/api/loan-agreement/generate", requireAuth, async (req, res) => {
    try {
      console.log("Loan agreement generation request:", req.body);
      
      const {
        loanDate,
        returnDate,
        borrowerName,
        borrowerPersonalId,
        borrowerLegalRep,
        borrowerAddress,
        borrowerPhone,
        borrowerEmail,
        bonevevRepresentativeName,
        dailyPenalty,
        equipmentList
      } = req.body;
      
      // Validate required fields
      if (!loanDate || !returnDate || !borrowerName || !borrowerPersonalId || 
          !borrowerAddress || !borrowerPhone || !borrowerEmail || 
          !bonevevRepresentativeName || !Array.isArray(equipmentList) || 
          equipmentList.length === 0) {
        return res.status(400).json({ 
          message: "Missing required fields for loan agreement generation" 
        });
      }
      
      // Generate a unique document ID
      const now = new Date();
      const year = now.getFullYear();
      const documentCounter = (await storage.listDocuments()).filter(doc => doc.type === 'Loan Agreement').length + 1;
      const documentId = `LA-${year}-${documentCounter.toString().padStart(3, '0')}`;
      
      // Create a document record for the generated agreement (no inventory impact)
      const agreementDocument = await storage.createDocument({
        title: `Loan Agreement - ${borrowerName}`,
        type: "Loan Agreement", 
        documentId: documentId,
        relatedItemId: null, // No link to loan group since this is purely documentary
        content: JSON.stringify({
          loanDate,
          returnDate,
          borrowerName,
          borrowerPersonalId,
          borrowerLegalRep,
          borrowerAddress,
          borrowerPhone,
          borrowerEmail,
          bonevevRepresentativeName,
          dailyPenalty,
          equipmentList
        })
      });
      
      // Log the activity
      await storage.createActivityLog({
        userId: (req.user as any).id,
        action: "Generate",
        entityType: "Document",
        entityId: agreementDocument.id.toString(),
        details: `Generated Albanian loan agreement document for ${borrowerName} with ${equipmentList.length} equipment item(s) (documentary only, no inventory impact)`
      });
      
      res.json({
        success: true,
        message: "Loan agreement generated successfully",
        documentId: agreementDocument.id,
        agreementData: {
          loanDate,
          returnDate,
          borrowerName,
          borrowerPersonalId,
          borrowerLegalRep,
          borrowerAddress,
          borrowerPhone,
          borrowerEmail,
          bonevevRepresentativeName,
          dailyPenalty,
          equipmentList
        }
      });
      
    } catch (error: any) {
      console.error('Error generating loan agreement:', error);
      res.status(500).json({ message: "Failed to generate loan agreement" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// HTML generation function for loan agreements
function generateLoanAgreementHTML(agreementData: any): string {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('sq-AL', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const equipmentRows = agreementData.equipmentList.map((item: any, index: number) => `
    <tr>
      <td style="border: 1px solid #000; padding: 8px; text-align: center;">${index + 1}</td>
      <td style="border: 1px solid #000; padding: 8px;">${item.name || ''}</td>
      <td style="border: 1px solid #000; padding: 8px;">${item.model || ''}</td>
      <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.quantity || 1}</td>
      <td style="border: 1px solid #000; padding: 8px;">${item.initialCondition || ''}</td>
      <td style="border: 1px solid #000; padding: 8px;"></td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="sq">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Marrëveshje për Huazimin e Pajisjeve</title>
      <style>
        @page {
          size: A4;
          margin: 20mm;
        }
        
        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          line-height: 1.4;
          color: #000;
          margin: 0;
          padding: 0;
        }
        
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #000;
          padding-bottom: 15px;
        }
        
        .title {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        
        .subtitle {
          font-size: 14px;
          margin-bottom: 5px;
        }
        
        .section {
          margin-bottom: 20px;
        }
        
        .section-title {
          font-weight: bold;
          margin-bottom: 10px;
          font-size: 13px;
          text-decoration: underline;
        }
        
        .info-row {
          margin-bottom: 8px;
          display: flex;
          align-items: center;
        }
        
        .info-label {
          font-weight: bold;
          min-width: 120px;
          display: inline-block;
        }
        
        .info-value {
          border-bottom: 1px solid #000;
          min-width: 200px;
          padding-bottom: 2px;
          margin-left: 10px;
        }
        
        .equipment-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        
        .equipment-table th,
        .equipment-table td {
          border: 1px solid #000;
          padding: 8px;
          text-align: left;
        }
        
        .equipment-table th {
          background-color: #f5f5f5;
          font-weight: bold;
          text-align: center;
        }
        
        .signature-section {
          margin-top: 40px;
          display: flex;
          justify-content: space-between;
        }
        
        .signature-box {
          text-align: center;
          width: 45%;
        }
        
        .signature-line {
          border-bottom: 1px solid #000;
          height: 50px;
          margin-bottom: 5px;
        }
        
        .terms {
          margin-top: 30px;
          font-size: 11px;
          line-height: 1.3;
        }
        
        .terms-title {
          font-weight: bold;
          margin-bottom: 10px;
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">MARRËVESHJE PËR HUAZIMIN E PAJISJEVE</div>
        <div class="subtitle">FONDACIONI "BONEVET"</div>
        <div class="subtitle">Rruga "Fehmi Agani", Kompleksi "Arbëria", Prishtinë</div>
      </div>
      
      <div class="section">
        <div class="info-row">
          <span class="info-label">Data e huazimit:</span>
          <span class="info-value">${formatDate(agreementData.loanDate)}</span>
          <span style="margin-left: 50px;" class="info-label">Data e kthimit:</span>
          <span class="info-value">${formatDate(agreementData.returnDate)}</span>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">TË DHËNAT E HUAMARRËSIT:</div>
        <div class="info-row">
          <span class="info-label">Emri i plotë:</span>
          <span class="info-value">${agreementData.borrowerName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Nr. i ID-së:</span>
          <span class="info-value">${agreementData.borrowerPersonalId}</span>
        </div>
        ${agreementData.borrowerLegalRep ? `
        <div class="info-row">
          <span class="info-label">Përfaqësuesi ligjor:</span>
          <span class="info-value">${agreementData.borrowerLegalRep}</span>
        </div>
        ` : ''}
        <div class="info-row">
          <span class="info-label">Adresa:</span>
          <span class="info-value">${agreementData.borrowerAddress}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Nr. i telefonit:</span>
          <span class="info-value">${agreementData.borrowerPhone}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Email:</span>
          <span class="info-value">${agreementData.borrowerEmail}</span>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">LISTA E PAJISJEVE TË HUAZUARA:</div>
        <table class="equipment-table">
          <thead>
            <tr>
              <th style="width: 8%;">Nr.</th>
              <th style="width: 25%;">Emri i pajisjes</th>
              <th style="width: 20%;">Modeli</th>
              <th style="width: 12%;">Sasia</th>
              <th style="width: 25%;">Gjendja fillestare</th>
              <th style="width: 25%;">Gjendja në kthim</th>
            </tr>
          </thead>
          <tbody>
            ${equipmentRows}
          </tbody>
        </table>
      </div>
      
      <div class="section">
        <div class="info-row">
          <span class="info-label">Përfaqësuesi i BONEVET-it:</span>
          <span class="info-value">${agreementData.bonevevRepresentativeName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Dënimi ditor (në rast vonese):</span>
          <span class="info-value">${agreementData.dailyPenalty} EUR</span>
        </div>
      </div>
      
      <div class="terms">
        <div class="terms-title">KUSHTET E HUAZIMIT:</div>
        <p>1. Huamarrësi detyrohet t'i kthejë pajisjet në gjendjen e njëjtë siç i ka marrë, deri në datën e caktuar të kthimit.</p>
        <p>2. Në rast dëmtimi apo humbjeje së pajisjeve, huamarrësi detyrohet t'i kompensojë ato sipas vlerës së tregut.</p>
        <p>3. Vonesa në kthim do të penalizohet me ${agreementData.dailyPenalty} EUR për çdo ditë vonesë.</p>
        <p>4. Pajisjet mund të përdoren vetëm për qëllime edukative dhe jo komerciale.</p>
        <p>5. Kjo marrëveshje hyn në fuqi me nënshkrimin e të dyja palëve.</p>
      </div>
      
      <div class="signature-section">
        <div class="signature-box">
          <div class="signature-line"></div>
          <div><strong>Nënshkrimi i huamarrësit</strong></div>
          <div>${agreementData.borrowerName}</div>
        </div>
        <div class="signature-box">
          <div class="signature-line"></div>
          <div><strong>Nënshkrimi i përfaqësuesit të BONEVET-it</strong></div>
          <div>${agreementData.bonevevRepresentativeName}</div>
        </div>
      </div>
    </body>
    </html>
  `;
}
