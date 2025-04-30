import { 
  users, User, InsertUser,
  inventoryItems, InventoryItem, InsertInventoryItem,
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

  // Loan Operations
  getLoan(id: number): Promise<Loan | undefined>;
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
  private loans: Map<number, Loan>;
  private documents: Map<number, Document>;
  private activityLogs: Map<number, ActivityLog>;
  
  private userIdCounter: number;
  private inventoryIdCounter: number;
  private loanIdCounter: number;
  private documentIdCounter: number;
  private activityLogIdCounter: number;

  constructor() {
    this.users = new Map();
    this.inventoryItems = new Map();
    this.loans = new Map();
    this.documents = new Map();
    this.activityLogs = new Map();
    
    this.userIdCounter = 1;
    this.inventoryIdCounter = 1;
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
    const total = items.length;
    const available = items.filter(item => item.status === "Available").length;
    const loaned = items.filter(item => item.status === "Loaned Out").length;
    const damaged = items.filter(item => item.status === "Damaged").length;
    
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

  // Loan Operations
  async getLoan(id: number): Promise<Loan | undefined> {
    return this.loans.get(id);
  }

  async createLoan(insertLoan: InsertLoan): Promise<Loan> {
    const id = this.loanIdCounter++;
    const loan: Loan = { 
      ...insertLoan, 
      id,
      actualReturnDate: null,
      status: "Ongoing"
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

  async getRecentLoans(limit: number): Promise<Loan[]> {
    const allLoans = Array.from(this.loans.values());
    return allLoans
      .sort((a, b) => new Date(b.loanDate).getTime() - new Date(a.loanDate).getTime())
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
}

export const storage = new MemStorage();
