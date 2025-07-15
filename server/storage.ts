import { 
  users, User, InsertUser,
  inventoryItems, InventoryItem, InsertInventoryItem,
  loanGroups, LoanGroup, InsertLoanGroup,
  loans, Loan, InsertLoan,
  documents, Document, InsertDocument,
  activityLogs, ActivityLog, InsertActivityLog
} from "@shared/schema";

// Storage Interface
export interface IStorage {
  // User Operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  listUsers(): Promise<User[]>;
  updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;

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
  updateItemLifecycle(itemId: number, lifecycleStatuses: string[], lifecycleDate: string, lifecycleReason: string): Promise<InventoryItem | undefined>;

  // Loan Group Operations
  getLoanGroup(id: number): Promise<LoanGroup & { items: (Loan & { item: InventoryItem })[] }>;
  getLoanGroupByLoanGroupId(loanGroupId: string): Promise<LoanGroup & { items: (Loan & { item: InventoryItem })[] } | undefined>;
  createLoanGroup(loanGroup: InsertLoanGroup, itemIds: number[]): Promise<LoanGroup & { items: Loan[] }>;
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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private inventoryItems: Map<number, InventoryItem>;
  private loanGroups: Map<number, LoanGroup>;
  private loans: Map<number, Loan>;
  private documents: Map<number, Document>;
  private activityLogs: Map<number, ActivityLog>;
  
  private userIdCounter: number;
  private inventoryIdCounter: number;
  private loanGroupIdCounter: number;
  private loanIdCounter: number;
  private documentIdCounter: number;
  private activityLogIdCounter: number;

  constructor() {
    this.users = new Map();
    this.inventoryItems = new Map();
    this.loanGroups = new Map();
    this.loans = new Map();
    this.documents = new Map();
    this.activityLogs = new Map();
    
    this.userIdCounter = 1;
    this.inventoryIdCounter = 1;
    this.loanGroupIdCounter = 1;
    this.loanIdCounter = 1;
    this.documentIdCounter = 1;
    this.activityLogIdCounter = 1;
    
    // Add default admin user
    this.createUser({
      username: "admin",
      password: "admin123", // In a real app, this would be hashed
      name: "Admin User",
      email: "admin@bonevet.org",
      role: "admin",
      active: true
    });
    
    // Add some sample inventory items for testing
    this.createInventoryItem({
      itemId: "BVGJK0001",
      name: "Prusa i3 MK3S+",
      model: "MK3S+",
      category: "Equipment",
      status: "Available",
      location: "Main Workshop",
      quantity: 1,
      price: 899,
      usage: "None",
      notes: "3D Printer"
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
    return Array.from(this.inventoryItems.values());
  }

  async updateInventoryItem(id: number, itemData: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined> {
    const item = this.inventoryItems.get(id);
    if (!item) return undefined;
    
    const updatedItem = { 
      ...item, 
      ...itemData,
      updatedAt: new Date()
    };
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
  
  async createLoanGroup(loanGroupData: InsertLoanGroup, itemIds: number[]): Promise<LoanGroup & { items: Loan[] }> {
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
    
    // Create individual loan entries for each item
    const loanItems: Loan[] = [];
    
    for (const itemId of itemIds) {
      const loan = await this.createLoan({ 
        loanGroupId: id, 
        itemId, 
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
  
  async listLoanGroups(): Promise<LoanGroup[]> {
    return Array.from(this.loanGroups.values());
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
    
    // Update inventory item status
    const item = await this.getInventoryItem(insertLoan.itemId);
    if (item) {
      await this.updateInventoryItem(item.id, { status: "Loaned Out" });
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
    
    // Update inventory item status
    const item = await this.getInventoryItem(loan.itemId);
    if (item) {
      await this.updateInventoryItem(item.id, { status: "Available" });
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

  async listActivityLogs(): Promise<ActivityLog[]> {
    return Array.from(this.activityLogs.values());
  }

  async getRecentActivityLogs(limit: number): Promise<ActivityLog[]> {
    const allLogs = Array.from(this.activityLogs.values());
    return allLogs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // Quantity Management Operations
  async updateItemQuantities(itemId: number, quantityLoaned: number, quantityDamaged: number): Promise<InventoryItem | undefined> {
    const item = this.inventoryItems.get(itemId);
    if (!item) return undefined;
    
    const quantityAvailable = item.quantity - quantityLoaned - quantityDamaged;
    
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

  async updateItemLifecycle(itemId: number, lifecycleStatuses: string[], lifecycleDate: string, lifecycleReason: string): Promise<InventoryItem | undefined> {
    const item = this.inventoryItems.get(itemId);
    if (!item) return undefined;
    
    const updatedItem = {
      ...item,
      lifecycleStatuses,
      lifecycleDate,
      lifecycleReason,
      updatedAt: new Date()
    };
    
    this.inventoryItems.set(itemId, updatedItem);
    return updatedItem;
  }
}

export const storage = new MemStorage();
