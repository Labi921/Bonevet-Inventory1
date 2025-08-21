# BONEVET Inventory Management System

## Overview

BONEVET is a comprehensive inventory management system built with a modern full-stack architecture. The application handles inventory tracking, loan management, document generation, user management, and audit logging for organizational asset management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state management
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **Styling**: Tailwind CSS with CSS variables for theming
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **Database**: PostgreSQL with Neon serverless driver
- **ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Passport.js with local strategy and express-session
- **File Uploads**: Multer for handling image uploads

### Build System
- **Frontend Build**: Vite with React plugin
- **Backend Build**: esbuild for production bundling
- **Development**: tsx for TypeScript execution in development
- **Hot Reload**: Vite HMR for frontend, nodemon-like restart for backend

## Key Components

### Database Schema
- **Users**: Authentication and role-based access control
- **Inventory Items**: Core asset tracking with categories, status, and metadata
- **Loan Groups**: Batch loan management for multiple items
- **Individual Loans**: Single item loan tracking
- **Documents**: Generated reports and documentation with digital signatures
- **Activity Logs**: Comprehensive audit trail for all system operations

### Authentication System
- Session-based authentication with Passport.js
- Role-based access control (admin/user roles)
- Protected routes with authentication middleware
- Context-based authentication state management

### Inventory Management
- Item categorization with 10 new categories:
  1. Fabrication Equipment (Everything used for creating, cutting, or shaping materials)
  2. Electronics & IoT (All electrical/electronic components, devices, and tools)
  3. Tools & Handheld Devices (Manual or portable powered tools)
  4. Machinery & Heavy Equipment (Large powered machines for workshop use)
  5. Hardware & Fasteners (Small physical parts for building and assembly)
  6. Furniture & Fixtures (Physical setup and storage of the workspace)
  7. Safety & Protection (All safety gear and compliance equipment)
  8. Software & Digital Resources (All digital tools and licenses)
  9. Consumables (Items that get used up and need regular restocking)
  10. Learning & Educational Kits (Items for training, workshops, and teaching)
- Category selection with hover tooltips showing descriptions
- Status tracking (Available, In Use, Loaned Out, Damaged, Maintenance)
- Usage classification (None, Staff, Members, Others)
- Quantity and pricing management with unitPrice field
- Location tracking and notes

### Loan Management
- Individual item loans with borrower tracking
- Multi-item loan groups for batch operations
- Date tracking (loan date, expected return, actual return)
- Status management (Ongoing, Returned, Overdue)
- Contact information for borrowers

### Document System
- Dynamic document generation for acquisitions, loans, and reports
- Digital signature capabilities
- Document versioning and audit trail
- Template-based content generation
- Borrowing request system for external equipment requests

### Barcode System
- Equipment barcode generation with JsBarcode library
- Avery 64x34mm label format for A4 printing
- PDF export with html2canvas and jsPDF
- Inventory audit functionality with barcode scanning
- Real-time barcode lookup and validation
- Comprehensive audit reports with missing/extra item tracking

## Data Flow

### Authentication Flow
1. User submits credentials via login form
2. Passport.js validates against database
3. Session established with user context
4. Protected routes check authentication status
5. Role-based access control enforced

### Inventory Operations
1. Items created/updated through forms with Zod validation
2. Changes processed through Express API endpoints
3. Drizzle ORM handles database operations
4. Activity logs automatically generated
5. Real-time updates via TanStack Query invalidation

### Loan Management Flow
1. Available items selected for loan creation
2. Borrower information captured with validation
3. Loan records created with status tracking
4. Inventory status automatically updated
5. Return process updates both loan and inventory status

## External Dependencies

### Core Libraries
- **@neondatabase/serverless**: PostgreSQL serverless connection
- **drizzle-orm**: Type-safe database operations
- **@tanstack/react-query**: Server state management
- **@radix-ui/react-***: Accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **react-hook-form**: Form state management
- **zod**: Runtime type validation
- **date-fns**: Date manipulation utilities

### Development Tools
- **vite**: Frontend build tool and dev server
- **tsx**: TypeScript execution for development
- **esbuild**: Fast JavaScript bundler
- **@replit/vite-plugin-***: Replit-specific development enhancements

### Barcode Libraries
- **jsbarcode**: CODE128 barcode generation
- **html2canvas**: Canvas-based PDF rendering
- **jspdf**: PDF generation for printable labels

### File Storage
- **multer**: Multipart form data handling for file uploads
- Local file system storage for uploaded images
- Support for common image formats (JPEG, PNG, GIF, WebP)

## Deployment Strategy

### Development Environment
- Vite dev server for frontend with HMR
- tsx for backend development with auto-restart
- Environment variables for database configuration
- Replit-specific plugins for development experience

### Production Build
- Frontend: Vite build with static asset optimization
- Backend: esbuild bundling for Node.js deployment
- Database migrations: Drizzle Kit for schema management
- Session storage: Memory store (can be upgraded to Redis)

### Environment Configuration
- **DATABASE_URL**: PostgreSQL connection string (required)
- **NODE_ENV**: Environment specification (development/production)
- Session secret configuration for security
- File upload directory configuration

### Scalability Considerations
- Neon serverless database for automatic scaling
- Stateless backend design for horizontal scaling
- Client-side caching with TanStack Query
- Optimized database queries with proper indexing
- Session store can be migrated to Redis for clustering

The system is designed with modularity and maintainability in mind, following modern web development patterns and best practices for enterprise inventory management.