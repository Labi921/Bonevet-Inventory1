import { 
  users, User, InsertUser,
  inventoryItems, InventoryItem, InsertInventoryItem,
  loanGroups, LoanGroup, InsertLoanGroup,
  loans, Loan, InsertLoan,
  documents, Document, InsertDocument,
  activityLogs, ActivityLog, InsertActivityLog,
  lifecycleHistory, LifecycleHistory, InsertLifecycleHistory,
  categories, Category, InsertCategory,
  resources, Resource, InsertResource,
  resourceCategories, ResourceCategory, InsertResourceCategory,
  resourceAttachments, ResourceAttachment, InsertResourceAttachment,
  passwordResetTokens, PasswordResetToken, InsertPasswordResetToken
} from "@shared/schema";
import { db } from './db';
import { eq, desc } from 'drizzle-orm';

// Storage Interface
export interface IStorage {
  // User Operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  listUsers(): Promise<User[]>;
  updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getUserByEmail(email: string): Promise<User | undefined>;

  // Password Reset Operations
  createPasswordResetToken(tokenData: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: number): Promise<boolean>;
  deleteExpiredPasswordResetTokens(): Promise<boolean>;

  // Inventory Operations
  getInventoryItem(id: number): Promise<InventoryItem | undefined>;
  getInventoryItemByItemId(itemId: string): Promise<InventoryItem | undefined>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  listInventoryItems(): Promise<InventoryItem[]>;
  updateInventoryItem(id: number, itemData: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined>;
  deleteInventoryItem(id: number): Promise<boolean>;
  countInventoryItems(): Promise<{ total: number, available: number, loaned: number, damaged: number }>;
  getInventoryItemsByCategory(): Promise<{ category: string, count: number }[]>;
  
  // Quantity Management
  updateItemQuantities(itemId: number, quantityLoaned: number, quantityDamaged: number): Promise<InventoryItem | undefined>;
  markItemDamaged(itemId: number, quantity: number): Promise<InventoryItem | undefined>;
  markItemRepaired(itemId: number, quantity: number): Promise<InventoryItem | undefined>;
  
  // Asset Lifecycle Management
  updateItemLifecycle(itemId: number, lifecycleStatuses: string[], lifecycleDate: string, lifecycleReason: string, quantityLifecycled: number): Promise<InventoryItem | undefined>;
  
  // Lifecycle History Operations
  createLifecycleHistory(history: InsertLifecycleHistory): Promise<LifecycleHistory>;
  getLifecycleHistoryByItemId(itemId: number): Promise<LifecycleHistory[]>;
  listLifecycleHistory(): Promise<LifecycleHistory[]>;

  // Loan Group Operations
  getLoanGroup(id: number): Promise<LoanGroup & { items: (Loan & { item: InventoryItem })[] }>;
  getLoanGroupByLoanGroupId(loanGroupId: string): Promise<LoanGroup & { items: (Loan & { item: InventoryItem })[] } | undefined>;
  createLoanGroup(loanGroup: InsertLoanGroup, itemsData: Array<{ id: number; quantity: number }>): Promise<LoanGroup & { items: Loan[] }>;
  listLoanGroups(): Promise<LoanGroup[]>;
  updateLoanGroup(id: number, loanGroupData: Partial<Omit<InsertLoanGroup, 'items'>>): Promise<LoanGroup | undefined>;
  markLoanGroupReturned(id: number, actualReturnDate: Date): Promise<LoanGroup | undefined>;
  deleteLoanGroup(id: number): Promise<boolean>;
  getRecentLoanGroups(limit: number): Promise<LoanGroup[]>;

  // Loan Operations (Individual items)
  getLoan(id: number): Promise<Loan | undefined>;
  getLoansByLoanGroupId(loanGroupId: number): Promise<(Loan & { item: InventoryItem })[]>;
  createLoan(loan: InsertLoan): Promise<Loan>;
  listLoans(): Promise<Loan[]>;
  updateLoan(id: number, loanData: Partial<InsertLoan>): Promise<Loan | undefined>;
  markLoanReturned(id: number, actualReturnDate: Date): Promise<Loan | undefined>;
  deleteLoan(id: number): Promise<boolean>;
  getRecentLoans(limit: number): Promise<Loan[]>;

  // Document Operations
  getDocument(id: number): Promise<Document | undefined>;
  getDocumentByDocumentId(documentId: string): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  listDocuments(): Promise<Document[]>;
  updateDocument(id: number, documentData: Partial<InsertDocument>): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<boolean>;

  // Activity Log Operations
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  listActivityLogs(): Promise<ActivityLog[]>;
  getRecentActivityLogs(limit: number): Promise<ActivityLog[]>;

  // Category Operations
  getCategory(id: number): Promise<Category | undefined>;
  getCategoryByName(name: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  listCategories(): Promise<Category[]>;
  listActiveCategories(): Promise<Category[]>;
  updateCategory(id: number, categoryData: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<boolean>;
  reorderCategories(categoryIds: number[]): Promise<Category[]>;

  // Resource Operations
  getResource(id: number): Promise<Resource | undefined>;
  createResource(resource: InsertResource): Promise<Resource>;
  listResources(): Promise<Resource[]>;
  listResourcesByType(type: string): Promise<Resource[]>;
  updateResource(id: number, resourceData: Partial<InsertResource>): Promise<Resource | undefined>;
  deleteResource(id: number): Promise<boolean>;

  // Resource Category Operations
  getResourceCategory(id: number): Promise<ResourceCategory | undefined>;
  createResourceCategory(categoryData: InsertResourceCategory): Promise<ResourceCategory>;
  listResourceCategories(): Promise<ResourceCategory[]>;
  listActiveResourceCategories(): Promise<ResourceCategory[]>;
  updateResourceCategory(id: number, categoryData: Partial<InsertResourceCategory>): Promise<ResourceCategory | undefined>;
  deleteResourceCategory(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private inventoryItems: Map<number, InventoryItem>;
  private loanGroups: Map<number, LoanGroup>;
  private loans: Map<number, Loan>;
  private documents: Map<number, Document>;
  private activityLogs: Map<number, ActivityLog>;
  private lifecycleHistories: Map<number, LifecycleHistory>;
  private categories: Map<number, Category>;
  private resources: Map<number, Resource>;
  
  private userIdCounter: number;
  private inventoryIdCounter: number;
  private loanGroupIdCounter: number;
  private loanIdCounter: number;
  private documentIdCounter: number;
  private activityLogIdCounter: number;
  private lifecycleHistoryIdCounter: number;
  private categoryIdCounter: number;
  private resourceIdCounter: number;

  constructor() {
    this.users = new Map();
    this.inventoryItems = new Map();
    this.loanGroups = new Map();
    this.loans = new Map();
    this.documents = new Map();
    this.activityLogs = new Map();
    this.lifecycleHistories = new Map();
    this.categories = new Map();
    this.resources = new Map();
    
    this.userIdCounter = 1;
    this.inventoryIdCounter = 1;
    this.loanGroupIdCounter = 1;
    this.loanIdCounter = 1;
    this.documentIdCounter = 1;
    this.activityLogIdCounter = 1;
    this.lifecycleHistoryIdCounter = 1;
    this.categoryIdCounter = 1;
    this.resourceIdCounter = 1;
    
    // Add default admin user
    this.createUser({
      username: "admin",
      password: "admin123", // In a real app, this would be hashed
      name: "Admin User",
      email: "admin@bonevet.org",
      role: "superadmin",
      active: true
    });

    // Add sample staff user
    this.createUser({
      username: "staff",
      password: "staff123",
      name: "Staff User",
      email: "staff@bonevet.org",
      role: "staff_user",
      active: true
    });

    // Add sample resources
    this.createResource({
      title: "Prusa i3 MK3S+ User Manual",
      description: "Complete user manual for operating and maintaining the Prusa i3 MK3S+ 3D printer",
      type: "manual",
      fileUrl: "https://cdn.prusa3d.com/downloads/manual/prusa3d_manual_mk3s_en.pdf",
      category: "3D Printers",
      uploadedBy: 1,
      isActive: true
    });

    this.createResource({
      title: "Arduino Programming Tutorial",
      description: "Learn the basics of Arduino programming and electronics prototyping",
      type: "video",
      videoUrl: "https://www.youtube.com/watch?v=nL34zDTPkcs",
      category: "Electronics",
      uploadedBy: 1,
      isActive: true
    });

    this.createResource({
      title: "BONEVET Makerspace Rules",
      description: "Official rules and regulations for using the BONEVET makerspace facilities",
      type: "rules",
      fileUrl: "https://example.com/bonevet-rules.pdf",
      uploadedBy: 1,
      isActive: true
    });

    this.createResource({
      title: "Soldering Iron Safety Guide", 
      description: "Essential safety procedures for using soldering equipment",
      type: "document",
      fileUrl: "https://example.com/soldering-safety.pdf",
      category: "Electronics",
      uploadedBy: 1,
      isActive: true
    });
    
    // Add some sample inventory items for testing
    this.createInventoryItem({
      itemId: "BVGJK0001",
      name: "Prusa i3 MK3S+",
      model: "MK3S+",
      category: "Fabrication Equipment",
      status: "Available",
      location: "Main Workshop",
      quantity: 1,
      price: 899,
      usage: "None",
      notes: "3D Printer"
    });

    // Initialize default categories
    this.initializeDefaultCategories();
  }

  private initializeDefaultCategories() {
    const defaultCategories = [
      { name: "Fabrication Equipment", description: "Everything used for creating, cutting, or shaping materials" },
      { name: "Electronics & IoT", description: "All electrical/electronic components, devices, and tools" },
      { name: "Tools & Handheld Devices", description: "Manual or portable powered tools" },
      { name: "Machinery & Heavy Equipment", description: "Large powered machines for workshop use" },
      { name: "Hardware & Fasteners", description: "Small physical parts for building and assembly" },
      { name: "Furniture & Fixtures", description: "Physical setup and storage of the workspace" },
      { name: "Safety & Protection", description: "All safety gear and compliance equipment" },
      { name: "Software & Digital Resources", description: "All digital tools and licenses" },
      { name: "Consumables", description: "Items that get used up and need regular restocking" },
      { name: "Learning & Educational Kits", description: "Items for training, workshops, and teaching" }
    ];

    defaultCategories.forEach((category, index) => {
      const id = this.categoryIdCounter++;
      const now = new Date();
      const categoryData: Category = {
        id,
        name: category.name,
        description: category.description,
        sortOrder: index,
        isActive: true,
        createdAt: now,
        updatedAt: now
      };
      this.categories.set(id, categoryData);
    });
  }

  // User Operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async listUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    throw new Error("getUserByEmail not implemented in MemStorage");
  }

  // Password Reset Operations (not implemented in memory storage)
  async createPasswordResetToken(tokenData: InsertPasswordResetToken): Promise<PasswordResetToken> {
    throw new Error("Password reset not implemented in MemStorage");
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    throw new Error("Password reset not implemented in MemStorage");
  }

  async markPasswordResetTokenUsed(id: number): Promise<boolean> {
    throw new Error("Password reset not implemented in MemStorage");
  }

  async deleteExpiredPasswordResetTokens(): Promise<boolean> {
    throw new Error("Password reset not implemented in MemStorage");
  }

  // Inventory Operations
  async getInventoryItem(id: number): Promise<InventoryItem | undefined> {
    return this.inventoryItems.get(id);
  }

  async getInventoryItemByItemId(itemId: string): Promise<InventoryItem | undefined> {
    return Array.from(this.inventoryItems.values()).find(
      (item) => item.itemId === itemId,
    );
  }

  async createInventoryItem(insertItem: InsertInventoryItem): Promise<InventoryItem> {
    const id = this.inventoryIdCounter++;
    const now = new Date();
    const item: InventoryItem = { 
      ...insertItem, 
      id,
      // Initialize quantity tracking
      quantityAvailable: insertItem.quantity || 1,
      quantityLoaned: 0,
      quantityDamaged: 0,
      createdAt: now,
      updatedAt: now
    };
    this.inventoryItems.set(id, item);
    return item;
  }

  async listInventoryItems(): Promise<InventoryItem[]> {
    // Update quantities for all items to ensure accurate availability
    const items = Array.from(this.inventoryItems.values());
    const updatedItems = await Promise.all(
      items.map(async item => {
        const updated = await this.updateItemQuantities(item.itemId);
        return updated || item;
      })
    );
    return updatedItems;
  }

  async updateInventoryItem(id: number, itemData: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined> {
    const item = this.inventoryItems.get(id);
    if (!item) return undefined;
    
    const updatedItem = { 
      ...item, 
      ...itemData,
      updatedAt: new Date()
    };
    
    // If quantity is being updated, recalculate quantityAvailable
    if (itemData.quantity !== undefined) {
      const newQuantity = itemData.quantity;
      const quantityLoaned = item.quantityLoaned || 0;
      const quantityDamaged = item.quantityDamaged || 0;
      
      // Calculate lifecycle quantities from history
      const lifecycleHistories = Array.from(this.lifecycleHistories.values())
        .filter(h => h.itemId === id);
      const quantityLifecycled = lifecycleHistories.reduce((sum, h) => sum + h.quantityLifecycled, 0);
      
      // Available = Total - Loaned - Damaged - Lifecycled
      updatedItem.quantityAvailable = Math.max(0, newQuantity - quantityLoaned - quantityDamaged - quantityLifecycled);
    }
    
    this.inventoryItems.set(id, updatedItem);
    return updatedItem;
  }

  async deleteInventoryItem(id: number): Promise<boolean> {
    return this.inventoryItems.delete(id);
  }

  async countInventoryItems(): Promise<{ total: number, available: number, loaned: number, damaged: number }> {
    const items = Array.from(this.inventoryItems.values());
    const total = items.reduce((sum, item) => sum + item.quantity, 0);
    const available = items.reduce((sum, item) => sum + item.quantityAvailable, 0);
    const loaned = items.reduce((sum, item) => sum + item.quantityLoaned, 0);
    const damaged = items.reduce((sum, item) => sum + item.quantityDamaged, 0);
    
    return { total, available, loaned, damaged };
  }

  async getInventoryItemsByCategory(): Promise<{ category: string, count: number }[]> {
    const items = Array.from(this.inventoryItems.values());
    const categoryCounts = new Map<string, number>();
    
    items.forEach(item => {
      const count = categoryCounts.get(item.category) || 0;
      categoryCounts.set(item.category, count + 1);
    });
    
    return Array.from(categoryCounts.entries()).map(([category, count]) => ({
      category,
      count
    }));
  }

  // Loan Group Operations
  async getLoanGroup(id: number): Promise<LoanGroup & { items: (Loan & { item: InventoryItem })[] }> {
    const loanGroup = this.loanGroups.get(id);
    if (!loanGroup) {
      throw new Error(`Loan group with ID ${id} not found`);
    }
    
    const loans = await this.getLoansByLoanGroupId(id);
    return { ...loanGroup, items: loans };
  }
  
  async getLoanGroupByLoanGroupId(loanGroupId: string): Promise<LoanGroup & { items: (Loan & { item: InventoryItem })[] } | undefined> {
    const loanGroup = Array.from(this.loanGroups.values()).find(
      (group) => group.loanGroupId === loanGroupId,
    );
    
    if (!loanGroup) return undefined;
    
    const loans = await this.getLoansByLoanGroupId(loanGroup.id);
    return { ...loanGroup, items: loans };
  }
  
  async createLoanGroup(loanGroupData: InsertLoanGroup, itemsData: Array<{ id: number; quantity: number }>): Promise<LoanGroup & { items: Loan[] }> {
    // Create the loan group
    const id = this.loanGroupIdCounter++;
    const now = new Date();
    const year = now.getFullYear();
    
    // Generate a loan group ID in the format LOAN-2025-001
    const loanGroupId = `LOAN-${year}-${id.toString().padStart(3, '0')}`;
    
    const loanGroup: LoanGroup = {
      ...loanGroupData,
      id,
      loanGroupId,
      status: "Ongoing",
      createdAt: now
    };
    
    this.loanGroups.set(id, loanGroup);
    
    // Create individual loan entries for each item with quantities
    const loanItems: Loan[] = [];
    
    for (const itemData of itemsData) {
      const loan = await this.createLoan({ 
        loanGroupId: id, 
        itemId: itemData.id, 
        quantityLoaned: itemData.quantity,
        notes: loanGroupData.notes || null 
      });
      
      loanItems.push(loan);
    }
    
    // Generate a loan document
    await this.createDocument({
      documentId: `DOC-LOAN-${year}-${id.toString().padStart(3, '0')}`,
      type: "Loan",
      title: `Loan Agreement - ${loanGroupData.borrowerName}`,
      content: `This document certifies that the items have been loaned to ${loanGroupData.borrowerName} (${loanGroupData.borrowerType}) from ${new Date(loanGroup.loanDate).toISOString().split('T')[0]} until ${new Date(loanGroup.expectedReturnDate).toISOString().split('T')[0]}.`,
      relatedItemId: loanGroupId,
      signedBy: [],
      createdBy: loanGroupData.createdBy || 1
    });
    
    return { ...loanGroup, items: loanItems };
  }
  
  async listLoanGroups(): Promise<(LoanGroup & { items: (Loan & { item: InventoryItem })[] })[]> {
    const loanGroups = Array.from(this.loanGroups.values());
    const result = [];
    
    for (const group of loanGroups) {
      const items = await this.getLoansByLoanGroupId(group.id);
      result.push({ ...group, items });
    }
    
    return result;
  }
  
  async updateLoanGroup(id: number, loanGroupData: Partial<Omit<InsertLoanGroup, 'items'>>): Promise<LoanGroup | undefined> {
    const loanGroup = this.loanGroups.get(id);
    if (!loanGroup) return undefined;
    
    const updatedLoanGroup = { ...loanGroup, ...loanGroupData };
    this.loanGroups.set(id, updatedLoanGroup);
    return updatedLoanGroup;
  }
  
  async markLoanGroupReturned(id: number, actualReturnDate: Date): Promise<LoanGroup | undefined> {
    const loanGroup = this.loanGroups.get(id);
    if (!loanGroup) return undefined;
    
    // Update loan group status
    const updatedLoanGroup = {
      ...loanGroup,
      status: "Returned"
    };
    this.loanGroups.set(id, updatedLoanGroup);
    
    // Mark all associated loans as returned
    const loans = Array.from(this.loans.values()).filter(
      (loan) => loan.loanGroupId === id && loan.status !== "Returned"
    );
    
    for (const loan of loans) {
      await this.markLoanReturned(loan.id, actualReturnDate);
    }
    
    return updatedLoanGroup;
  }
  
  async deleteLoanGroup(id: number): Promise<boolean> {
    // Delete all associated loans first
    const loans = Array.from(this.loans.values()).filter(
      (loan) => loan.loanGroupId === id
    );
    
    for (const loan of loans) {
      await this.deleteLoan(loan.id);
    }
    
    return this.loanGroups.delete(id);
  }
  
  async getRecentLoanGroups(limit: number): Promise<LoanGroup[]> {
    const allLoanGroups = Array.from(this.loanGroups.values());
    return allLoanGroups
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
  
  // Loan Operations (Individual items)
  async getLoan(id: number): Promise<Loan | undefined> {
    return this.loans.get(id);
  }
  
  async getLoansByLoanGroupId(loanGroupId: number): Promise<(Loan & { item: InventoryItem })[]> {
    const loans = Array.from(this.loans.values()).filter(
      (loan) => loan.loanGroupId === loanGroupId
    );
    
    const result: (Loan & { item: InventoryItem })[] = [];
    
    for (const loan of loans) {
      const item = await this.getInventoryItem(loan.itemId);
      if (item) {
        result.push({ ...loan, item });
      }
    }
    
    return result;
  }

  async createLoan(insertLoan: InsertLoan): Promise<Loan> {
    const id = this.loanIdCounter++;
    const loan: Loan = { 
      ...insertLoan, 
      id,
      actualReturnDate: null,
      status: "Ongoing",
      // Ensure loanGroupId is defined for the database model
      loanGroupId: insertLoan.loanGroupId || null
    };
    this.loans.set(id, loan);
    
    // Update inventory item quantities
    const item = await this.getInventoryItem(insertLoan.itemId);
    if (item) {
      const quantityLoaned = insertLoan.quantityLoaned || 1;
      // Update quantities: reduce available, increase loaned
      await this.updateItemQuantities(
        insertLoan.itemId, 
        item.quantityLoaned + quantityLoaned, 
        item.quantityDamaged
      );
    }
    
    return loan;
  }

  async listLoans(): Promise<Loan[]> {
    return Array.from(this.loans.values());
  }

  async updateLoan(id: number, loanData: Partial<InsertLoan>): Promise<Loan | undefined> {
    const loan = this.loans.get(id);
    if (!loan) return undefined;
    
    const updatedLoan = { ...loan, ...loanData };
    this.loans.set(id, updatedLoan);
    return updatedLoan;
  }

  async markLoanReturned(id: number, actualReturnDate: Date): Promise<Loan | undefined> {
    const loan = this.loans.get(id);
    if (!loan) return undefined;
    
    const updatedLoan = { 
      ...loan, 
      actualReturnDate,
      status: "Returned"
    };
    this.loans.set(id, updatedLoan);
    
    // Update inventory item quantities: restore available, reduce loaned
    const item = await this.getInventoryItem(loan.itemId);
    if (item) {
      const quantityReturned = loan.quantityLoaned || 1;
      await this.updateItemQuantities(
        loan.itemId, 
        item.quantityLoaned - quantityReturned, 
        item.quantityDamaged
      );
    }
    
    return updatedLoan;
  }

  async deleteLoan(id: number): Promise<boolean> {
    return this.loans.delete(id);
  }

  async getRecentLoans(limit: number): Promise<any[]> {
    const allLoans = Array.from(this.loans.values());
    const combinedLoans = [];

    // First get individual loans (without a loan group)
    const individualLoans = allLoans.filter(loan => loan.loanGroupId === null);
    
    // Add borrower information to individual loans
    for (const loan of individualLoans) {
      const item = await this.getInventoryItem(loan.itemId);
      combinedLoans.push({
        ...loan,
        borrowerName: "Individual Loan", // This will be replaced in routes.ts
        borrowerType: "Individual",
        loanDate: loan.loanDate || new Date().toISOString()
      });
    }
    
    // Then get loan groups
    const loanGroups = Array.from(this.loanGroups.values());
    for (const group of loanGroups) {
      // Get the first item from the group to display
      const groupLoans = allLoans.filter(loan => loan.loanGroupId === group.id);
      if (groupLoans.length > 0) {
        const firstLoan = groupLoans[0];
        combinedLoans.push({
          ...firstLoan,
          borrowerName: group.borrowerName,
          borrowerType: group.borrowerType,
          loanDate: group.loanDate,
          expectedReturnDate: group.expectedReturnDate,
          isGroupLoan: true,
          loanGroupId: group.id,
          itemCount: groupLoans.length
        });
      }
    }
    
    // Sort by id descending (most recent first) and limit
    return combinedLoans
      .sort((a, b) => b.id - a.id)
      .slice(0, limit);
  }

  // Document Operations
  async getDocument(id: number): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async getDocumentByDocumentId(documentId: string): Promise<Document | undefined> {
    return Array.from(this.documents.values()).find(
      (doc) => doc.documentId === documentId,
    );
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = this.documentIdCounter++;
    const now = new Date();
    const document: Document = { 
      ...insertDocument, 
      id,
      createdAt: now
    };
    this.documents.set(id, document);
    return document;
  }

  async listDocuments(): Promise<Document[]> {
    return Array.from(this.documents.values());
  }

  async updateDocument(id: number, documentData: Partial<InsertDocument>): Promise<Document | undefined> {
    const document = this.documents.get(id);
    if (!document) return undefined;
    
    const updatedDocument = { ...document, ...documentData };
    this.documents.set(id, updatedDocument);
    return updatedDocument;
  }

  async deleteDocument(id: number): Promise<boolean> {
    return this.documents.delete(id);
  }

  // Activity Log Operations
  async createActivityLog(insertLog: InsertActivityLog): Promise<ActivityLog> {
    const id = this.activityLogIdCounter++;
    const now = new Date();
    const log: ActivityLog = { 
      ...insertLog, 
      id,
      timestamp: now
    };
    this.activityLogs.set(id, log);
    return log;
  }

  async listActivityLogs(): Promise<any[]> {
    const allLogs = Array.from(this.activityLogs.values());
    const enrichedLogs = [];
    
    for (const log of allLogs) {
      const user = this.users.get(log.userId);
      enrichedLogs.push({
        ...log,
        userName: user ? user.name : `User ${log.userId}`,
        userRole: user ? user.role : 'Unknown'
      });
    }
    
    return enrichedLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getRecentActivityLogs(limit: number): Promise<any[]> {
    const allLogs = Array.from(this.activityLogs.values());
    const enrichedLogs = [];
    
    for (const log of allLogs) {
      const user = this.users.get(log.userId);
      enrichedLogs.push({
        ...log,
        userName: user ? user.name : `User ${log.userId}`,
        userRole: user ? user.role : 'Unknown'
      });
    }
    
    return enrichedLogs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // Quantity Management Operations
  async updateItemQuantities(itemId: number, quantityLoaned: number, quantityDamaged: number): Promise<InventoryItem | undefined> {
    const item = this.inventoryItems.get(itemId);
    if (!item) return undefined;
    
    // Calculate lifecycle quantities from history
    const lifecycleHistories = Array.from(this.lifecycleHistories.values())
      .filter(h => h.itemId === itemId);
    const quantityLifecycled = lifecycleHistories.reduce((sum, h) => sum + h.quantityLifecycled, 0);
    
    // Available = Total - Loaned - Damaged - Lifecycled
    const quantityAvailable = Math.max(0, item.quantity - quantityLoaned - quantityDamaged - quantityLifecycled);
    
    // Determine status based on quantities
    let status = "Available";
    if (quantityAvailable <= 0) {
      if (quantityLoaned > 0 && quantityDamaged === 0) {
        status = "Loaned Out";
      } else if (quantityDamaged > 0 && quantityLoaned === 0) {
        status = "Damaged";
      } else if (quantityDamaged > 0 && quantityLoaned > 0) {
        status = "Partially Available";
      }
    } else if (quantityLoaned > 0 || quantityDamaged > 0) {
      status = "Partially Available";
    }
    
    const updatedItem = {
      ...item,
      quantityLoaned,
      quantityDamaged,
      quantityAvailable,
      status,
      updatedAt: new Date()
    };
    
    this.inventoryItems.set(itemId, updatedItem);
    return updatedItem;
  }

  async markItemDamaged(itemId: number, quantity: number): Promise<InventoryItem | undefined> {
    const item = this.inventoryItems.get(itemId);
    if (!item) return undefined;
    
    const newQuantityDamaged = item.quantityDamaged + quantity;
    const newQuantityAvailable = item.quantityAvailable - quantity;
    
    if (newQuantityAvailable < 0) {
      throw new Error("Not enough available quantity to mark as damaged");
    }
    
    const updatedItem = {
      ...item,
      quantityDamaged: newQuantityDamaged,
      quantityAvailable: newQuantityAvailable,
      updatedAt: new Date()
    };
    
    this.inventoryItems.set(itemId, updatedItem);
    return updatedItem;
  }

  async markItemRepaired(itemId: number, quantity: number): Promise<InventoryItem | undefined> {
    const item = this.inventoryItems.get(itemId);
    if (!item) return undefined;
    
    const newQuantityDamaged = item.quantityDamaged - quantity;
    const newQuantityAvailable = item.quantityAvailable + quantity;
    
    if (newQuantityDamaged < 0) {
      throw new Error("Cannot repair more items than are damaged");
    }
    
    const updatedItem = {
      ...item,
      quantityDamaged: newQuantityDamaged,
      quantityAvailable: newQuantityAvailable,
      updatedAt: new Date()
    };
    
    this.inventoryItems.set(itemId, updatedItem);
    return updatedItem;
  }

  async updateItemLifecycle(itemId: number, lifecycleStatuses: string[], lifecycleDate: string, lifecycleReason: string, quantityLifecycled: number): Promise<InventoryItem | undefined> {
    const item = this.inventoryItems.get(itemId);
    if (!item) return undefined;
    
    // Validate quantity
    if (quantityLifecycled > item.quantityAvailable) {
      throw new Error("Cannot lifecycle more items than are available");
    }
    
    // Create lifecycle history entry
    const historyId = this.lifecycleHistoryIdCounter++;
    const historyEntry: LifecycleHistory = {
      id: historyId,
      itemId: itemId,
      lifecycleStatuses,
      lifecycleDate,
      lifecycleReason,
      quantityLifecycled,
      createdAt: new Date(),
      createdBy: 1 // Admin user ID - in real app, this would be the current user
    };
    
    this.lifecycleHistories.set(historyId, historyEntry);
    
    // Update item quantities and set latest lifecycle info for backward compatibility
    const updatedItem = {
      ...item,
      lifecycleStatuses,
      lifecycleDate,
      lifecycleReason,
      quantityLifecycled: (item.quantityLifecycled || 0) + quantityLifecycled,
      quantityAvailable: item.quantityAvailable - quantityLifecycled,
      updatedAt: new Date()
    };
    
    this.inventoryItems.set(itemId, updatedItem);
    return updatedItem;
  }

  // Lifecycle History Operations
  async createLifecycleHistory(insertHistory: InsertLifecycleHistory): Promise<LifecycleHistory> {
    const id = this.lifecycleHistoryIdCounter++;
    const history: LifecycleHistory = {
      id,
      ...insertHistory,
      createdAt: new Date()
    };
    
    this.lifecycleHistories.set(id, history);
    return history;
  }

  async getLifecycleHistoryByItemId(itemId: number): Promise<LifecycleHistory[]> {
    return Array.from(this.lifecycleHistories.values())
      .filter(history => history.itemId === itemId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listLifecycleHistory(): Promise<LifecycleHistory[]> {
    return Array.from(this.lifecycleHistories.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Category Operations
  async getCategory(id: number): Promise<Category | undefined> {
    return this.categories.get(id);
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    return Array.from(this.categories.values()).find(
      (category) => category.name === name
    );
  }

  async createCategory(categoryData: InsertCategory): Promise<Category> {
    const id = this.categoryIdCounter++;
    const now = new Date();
    
    // Set sort order to be last
    const existingCategories = Array.from(this.categories.values());
    const maxSortOrder = existingCategories.length > 0 
      ? Math.max(...existingCategories.map(c => c.sortOrder)) 
      : -1;
    
    const category: Category = {
      id,
      ...categoryData,
      sortOrder: categoryData.sortOrder ?? maxSortOrder + 1,
      createdAt: now,
      updatedAt: now
    };
    this.categories.set(id, category);
    return category;
  }

  async listCategories(): Promise<Category[]> {
    return Array.from(this.categories.values())
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async listActiveCategories(): Promise<Category[]> {
    return Array.from(this.categories.values())
      .filter(category => category.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async reorderCategories(categoryIds: number[]): Promise<Category[]> {
    // Update sort order for all categories based on the new order
    categoryIds.forEach((categoryId, index) => {
      const category = this.categories.get(categoryId);
      if (category) {
        const updatedCategory = {
          ...category,
          sortOrder: index,
          updatedAt: new Date()
        };
        this.categories.set(categoryId, updatedCategory);
      }
    });
    
    return this.listCategories();
  }

  async updateCategory(id: number, categoryData: Partial<InsertCategory>): Promise<Category | undefined> {
    const category = this.categories.get(id);
    if (!category) return undefined;
    
    const updatedCategory = {
      ...category,
      ...categoryData,
      updatedAt: new Date()
    };
    this.categories.set(id, updatedCategory);
    return updatedCategory;
  }

  async deleteCategory(id: number): Promise<boolean> {
    return this.categories.delete(id);
  }

  // Resource Operations
  async getResource(id: number): Promise<Resource | undefined> {
    return this.resources.get(id);
  }

  async createResource(resourceData: InsertResource): Promise<Resource> {
    const id = this.resourceIdCounter++;
    const now = new Date();
    
    const resource: Resource = {
      id,
      ...resourceData,
      createdAt: now,
      updatedAt: now
    };
    this.resources.set(id, resource);
    return resource;
  }

  async listResources(): Promise<Resource[]> {
    return Array.from(this.resources.values())
      .filter(resource => resource.isActive)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listResourcesByType(type: string): Promise<Resource[]> {
    return Array.from(this.resources.values())
      .filter(resource => resource.isActive && resource.type === type)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateResource(id: number, resourceData: Partial<InsertResource>): Promise<Resource | undefined> {
    const resource = this.resources.get(id);
    if (!resource) return undefined;
    
    const updatedResource = {
      ...resource,
      ...resourceData,
      updatedAt: new Date()
    };
    this.resources.set(id, updatedResource);
    return updatedResource;
  }

  async deleteResource(id: number): Promise<boolean> {
    return this.resources.delete(id);
  }

  // Resource Category Operations (not implemented in memory storage)
  async getResourceCategory(id: number): Promise<ResourceCategory | undefined> {
    throw new Error("Resource categories not implemented in MemStorage");
  }

  async createResourceCategory(categoryData: InsertResourceCategory): Promise<ResourceCategory> {
    throw new Error("Resource categories not implemented in MemStorage");
  }

  async listResourceCategories(): Promise<ResourceCategory[]> {
    throw new Error("Resource categories not implemented in MemStorage");
  }

  async listActiveResourceCategories(): Promise<ResourceCategory[]> {
    throw new Error("Resource categories not implemented in MemStorage");
  }

  async updateResourceCategory(id: number, categoryData: Partial<InsertResourceCategory>): Promise<ResourceCategory | undefined> {
    throw new Error("Resource categories not implemented in MemStorage");
  }

  async deleteResourceCategory(id: number): Promise<boolean> {
    throw new Error("Resource categories not implemented in MemStorage");
  }
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  // Resource Operations
  async getResource(id: number): Promise<Resource | undefined> {
    const [resource] = await db.select().from(resources).where(eq(resources.id, id));
    return resource;
  }

  async createResource(resourceData: InsertResource): Promise<Resource> {
    const [resource] = await db
      .insert(resources)
      .values(resourceData)
      .returning();
    return resource;
  }

  async listResources(): Promise<Resource[]> {
    return await db
      .select()
      .from(resources)
      .where(eq(resources.isActive, true))
      .orderBy(desc(resources.createdAt));
  }

  async listResourcesByType(type: string): Promise<Resource[]> {
    return await db
      .select()
      .from(resources)
      .where(eq(resources.isActive, true))
      .where(eq(resources.type, type))
      .orderBy(desc(resources.createdAt));
  }

  async updateResource(id: number, resourceData: Partial<InsertResource>): Promise<Resource | undefined> {
    const [resource] = await db
      .update(resources)
      .set({ ...resourceData, updatedAt: new Date() })
      .where(eq(resources.id, id))
      .returning();
    return resource;
  }

  async deleteResource(id: number): Promise<boolean> {
    const result = await db
      .update(resources)
      .set({ isActive: false })
      .where(eq(resources.id, id));
    return result.rowCount > 0;
  }

  // Resource Attachment Operations  
  async getResourceAttachments(resourceId: number): Promise<ResourceAttachment[]> {
    return await db
      .select()
      .from(resourceAttachments) 
      .where(eq(resourceAttachments.resourceId, resourceId))
      .where(eq(resourceAttachments.isActive, true))
      .orderBy(resourceAttachments.sortOrder);
  }

  async createResourceAttachment(attachmentData: InsertResourceAttachment): Promise<ResourceAttachment> {
    const [attachment] = await db
      .insert(resourceAttachments)
      .values(attachmentData)
      .returning();
    return attachment;
  }

  async updateResourceAttachment(id: number, attachmentData: Partial<InsertResourceAttachment>): Promise<ResourceAttachment | undefined> {
    const [attachment] = await db
      .update(resourceAttachments)
      .set({ ...attachmentData, updatedAt: new Date() })
      .where(eq(resourceAttachments.id, id))
      .returning();
    return attachment;
  }

  async deleteResourceAttachment(id: number): Promise<boolean> {
    const result = await db
      .update(resourceAttachments)
      .set({ isActive: false })
      .where(eq(resourceAttachments.id, id));
    return result.rowCount > 0;
  }

  // Resource Category Operations
  async getResourceCategory(id: number): Promise<ResourceCategory | undefined> {
    const [category] = await db.select().from(resourceCategories).where(eq(resourceCategories.id, id));
    return category;
  }

  async createResourceCategory(categoryData: InsertResourceCategory): Promise<ResourceCategory> {
    const [category] = await db
      .insert(resourceCategories)
      .values(categoryData)
      .returning();
    return category;
  }

  async listResourceCategories(): Promise<ResourceCategory[]> {
    return await db
      .select()
      .from(resourceCategories)
      .orderBy(resourceCategories.sortOrder, resourceCategories.name);
  }

  async listActiveResourceCategories(): Promise<ResourceCategory[]> {
    return await db
      .select()
      .from(resourceCategories)
      .where(eq(resourceCategories.isActive, true))
      .orderBy(resourceCategories.sortOrder, resourceCategories.name);
  }

  async updateResourceCategory(id: number, categoryData: Partial<InsertResourceCategory>): Promise<ResourceCategory | undefined> {
    const [category] = await db
      .update(resourceCategories)
      .set({ ...categoryData, updatedAt: new Date() })
      .where(eq(resourceCategories.id, id))
      .returning();
    return category;
  }

  async deleteResourceCategory(id: number): Promise<boolean> {
    const result = await db
      .update(resourceCategories)
      .set({ isActive: false })
      .where(eq(resourceCategories.id, id));
    return result.rowCount > 0;
  }

  async reorderResourceCategory(id: number, direction: 'up' | 'down'): Promise<boolean> {
    // Get the current category
    const currentCategory = await this.getResourceCategory(id);
    if (!currentCategory) {
      return false;
    }

    // Get all active categories ordered by sortOrder
    const allCategories = await db
      .select()
      .from(resourceCategories)
      .where(eq(resourceCategories.isActive, true))
      .orderBy(resourceCategories.sortOrder);

    const currentIndex = allCategories.findIndex(cat => cat.id === id);
    if (currentIndex === -1) {
      return false;
    }

    // Check bounds
    if (direction === 'up' && currentIndex === 0) {
      return false; // Already at top
    }
    if (direction === 'down' && currentIndex === allCategories.length - 1) {
      return false; // Already at bottom
    }

    // Swap sortOrder with adjacent category
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const currentSortOrder = allCategories[currentIndex].sortOrder;
    const swapSortOrder = allCategories[swapIndex].sortOrder;

    // Update both categories
    await db.transaction(async (tx) => {
      await tx
        .update(resourceCategories)
        .set({ sortOrder: swapSortOrder, updatedAt: new Date() })
        .where(eq(resourceCategories.id, allCategories[currentIndex].id));

      await tx
        .update(resourceCategories)
        .set({ sortOrder: currentSortOrder, updatedAt: new Date() })
        .where(eq(resourceCategories.id, allCategories[swapIndex].id));
    });

    return true;
  }

  // Database User Operations  
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async listUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.active, true))
      .orderBy(desc(users.createdAt));
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.id, id));
    return result.rowCount > 0;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  // Password Reset Operations
  async createPasswordResetToken(tokenData: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [token] = await db
      .insert(passwordResetTokens)
      .values(tokenData)
      .returning();
    return token;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return resetToken;
  }

  async markPasswordResetTokenUsed(id: number): Promise<boolean> {
    const result = await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.id, id));
    return result.rowCount > 0;
  }

  async deleteExpiredPasswordResetTokens(): Promise<boolean> {
    const result = await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.used, true));
    return result.rowCount > 0;
  }

  // Forward all other methods to MemStorage for now
  async getInventoryItem(id: number): Promise<InventoryItem | undefined> { return memStorage.getInventoryItem(id); }
  async getInventoryItemByItemId(itemId: string): Promise<InventoryItem | undefined> { return memStorage.getInventoryItemByItemId(itemId); }
  async createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> { return memStorage.createInventoryItem(item); }
  async listInventoryItems(): Promise<InventoryItem[]> { return memStorage.listInventoryItems(); }
  async updateInventoryItem(id: number, itemData: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined> { return memStorage.updateInventoryItem(id, itemData); }
  async deleteInventoryItem(id: number): Promise<boolean> { return memStorage.deleteInventoryItem(id); }
  async countInventoryItems(): Promise<{ total: number, available: number, loaned: number, damaged: number }> { return memStorage.countInventoryItems(); }
  async getInventoryItemsByCategory(): Promise<{ category: string, count: number }[]> { return memStorage.getInventoryItemsByCategory(); }
  async updateItemQuantities(itemId: number, quantityLoaned: number, quantityDamaged: number): Promise<InventoryItem | undefined> { return memStorage.updateItemQuantities(itemId, quantityLoaned, quantityDamaged); }
  async markItemDamaged(itemId: number, quantity: number): Promise<InventoryItem | undefined> { return memStorage.markItemDamaged(itemId, quantity); }
  async markItemRepaired(itemId: number, quantity: number): Promise<InventoryItem | undefined> { return memStorage.markItemRepaired(itemId, quantity); }
  async updateItemLifecycle(itemId: number, lifecycleStatuses: string[], lifecycleDate: string, lifecycleReason: string, quantityLifecycled: number): Promise<InventoryItem | undefined> { return memStorage.updateItemLifecycle(itemId, lifecycleStatuses, lifecycleDate, lifecycleReason, quantityLifecycled); }
  async createLifecycleHistory(history: InsertLifecycleHistory): Promise<LifecycleHistory> { return memStorage.createLifecycleHistory(history); }
  async getLifecycleHistoryByItemId(itemId: number): Promise<LifecycleHistory[]> { return memStorage.getLifecycleHistoryByItemId(itemId); }
  async listLifecycleHistory(): Promise<LifecycleHistory[]> { return memStorage.listLifecycleHistory(); }
  async getLoanGroup(id: number): Promise<LoanGroup & { items: (Loan & { item: InventoryItem })[] }> { return memStorage.getLoanGroup(id); }
  async getLoanGroupByLoanGroupId(loanGroupId: string): Promise<LoanGroup & { items: (Loan & { item: InventoryItem })[] } | undefined> { return memStorage.getLoanGroupByLoanGroupId(loanGroupId); }
  async createLoanGroup(loanGroup: InsertLoanGroup, itemsData: Array<{ id: number; quantity: number }>): Promise<LoanGroup & { items: Loan[] }> { return memStorage.createLoanGroup(loanGroup, itemsData); }
  async listLoanGroups(): Promise<LoanGroup[]> { return memStorage.listLoanGroups(); }
  async updateLoanGroup(id: number, loanGroupData: Partial<Omit<InsertLoanGroup, 'items'>>): Promise<LoanGroup | undefined> { return memStorage.updateLoanGroup(id, loanGroupData); }
  async markLoanGroupReturned(id: number, actualReturnDate: Date): Promise<LoanGroup | undefined> { return memStorage.markLoanGroupReturned(id, actualReturnDate); }
  async deleteLoanGroup(id: number): Promise<boolean> { return memStorage.deleteLoanGroup(id); }
  async getRecentLoanGroups(limit: number): Promise<LoanGroup[]> { return memStorage.getRecentLoanGroups(limit); }
  async getLoan(id: number): Promise<Loan | undefined> { return memStorage.getLoan(id); }
  async getLoansByLoanGroupId(loanGroupId: number): Promise<(Loan & { item: InventoryItem })[]> { return memStorage.getLoansByLoanGroupId(loanGroupId); }
  async createLoan(loan: InsertLoan): Promise<Loan> { return memStorage.createLoan(loan); }
  async listLoans(): Promise<Loan[]> { return memStorage.listLoans(); }
  async updateLoan(id: number, loanData: Partial<InsertLoan>): Promise<Loan | undefined> { return memStorage.updateLoan(id, loanData); }
  async markLoanReturned(id: number, actualReturnDate: Date): Promise<Loan | undefined> { return memStorage.markLoanReturned(id, actualReturnDate); }
  async deleteLoan(id: number): Promise<boolean> { return memStorage.deleteLoan(id); }
  async getRecentLoans(limit: number): Promise<Loan[]> { return memStorage.getRecentLoans(limit); }
  async getDocument(id: number): Promise<Document | undefined> { return memStorage.getDocument(id); }
  async getDocumentByDocumentId(documentId: string): Promise<Document | undefined> { return memStorage.getDocumentByDocumentId(documentId); }
  async createDocument(document: InsertDocument): Promise<Document> { return memStorage.createDocument(document); }
  async listDocuments(): Promise<Document[]> { return memStorage.listDocuments(); }
  async updateDocument(id: number, documentData: Partial<InsertDocument>): Promise<Document | undefined> { return memStorage.updateDocument(id, documentData); }
  async deleteDocument(id: number): Promise<boolean> { return memStorage.deleteDocument(id); }
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> { return memStorage.createActivityLog(log); }
  async listActivityLogs(): Promise<ActivityLog[]> { return memStorage.listActivityLogs(); }
  async getRecentActivityLogs(limit: number): Promise<ActivityLog[]> { return memStorage.getRecentActivityLogs(limit); }
  async getCategory(id: number): Promise<Category | undefined> { return memStorage.getCategory(id); }
  async getCategoryByName(name: string): Promise<Category | undefined> { return memStorage.getCategoryByName(name); }
  async createCategory(category: InsertCategory): Promise<Category> { return memStorage.createCategory(category); }
  async listCategories(): Promise<Category[]> { return memStorage.listCategories(); }
  async listActiveCategories(): Promise<Category[]> { return memStorage.listActiveCategories(); }
  async updateCategory(id: number, categoryData: Partial<InsertCategory>): Promise<Category | undefined> { return memStorage.updateCategory(id, categoryData); }
  async deleteCategory(id: number): Promise<boolean> { return memStorage.deleteCategory(id); }
  async reorderCategories(categoryIds: number[]): Promise<Category[]> { return memStorage.reorderCategories(categoryIds); }
}

// Create instances
const memStorage = new MemStorage();
export const storage = new DatabaseStorage();
