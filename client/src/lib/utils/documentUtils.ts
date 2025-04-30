import { z } from "zod";

// Document types
export const documentTypeEnum = z.enum([
  "Acquisition",
  "Loan",
  "Other"
]);

// Function to generate unique document ID
export const generateDocumentId = (type: string) => {
  const date = new Date();
  const year = date.getFullYear();
  
  // Generate a random 3-digit number for uniqueness
  const random = Math.floor(Math.random() * 900) + 100;
  
  const typeCode = type === 'Acquisition' ? 'ACQ' : 
                  type === 'Loan' ? 'LOAN' : 'DOC';
  
  return `DOC-${typeCode}-${year}-${random}`;
};

// Template for acquisition document
export const getAcquisitionDocumentTemplate = (item?: any) => {
  return {
    documentType: 'Acquisition',
    itemDetails: item ? {
      itemId: item.itemId,
      name: item.name,
      category: item.category,
      model: item.model || '',
      price: item.price || 0,
      quantity: item.quantity || 1
    } : {
      itemId: '',
      name: '',
      category: '',
      model: '',
      price: 0,
      quantity: 1
    },
    acquisitionType: 'Purchase',
    acquisitionDate: new Date().toISOString(),
    notes: `This item was added to the BONEVET Gjakova inventory on ${new Date().toLocaleDateString()}.`,
    signatories: ['CEO', 'CTO']
  };
};

// Template for loan document
export const getLoanDocumentTemplate = (item?: any, loan?: any) => {
  return {
    documentType: 'Loan',
    itemDetails: item ? {
      itemId: item.itemId,
      name: item.name,
      category: item.category,
      model: item.model || ''
    } : {
      itemId: '',
      name: '',
      category: '',
      model: ''
    },
    loanDetails: loan ? {
      borrowerName: loan.borrowerName,
      borrowerType: loan.borrowerType,
      loanDate: loan.loanDate,
      expectedReturnDate: loan.expectedReturnDate
    } : {
      borrowerName: '',
      borrowerType: '',
      loanDate: new Date().toISOString(),
      expectedReturnDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    },
    termsAndConditions: 'The borrower agrees to return the item in the same condition as received. Any damages will be the responsibility of the borrower.',
    signatories: ['Lender', 'Borrower']
  };
};

// Get document type badge class
export const getDocumentTypeClass = (type: string) => {
  switch (type) {
    case 'Acquisition':
      return 'bg-blue-100 text-blue-800';
    case 'Loan':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

// Function to format document content for display
export const formatDocumentContent = (content: string) => {
  try {
    const parsed = JSON.parse(content);
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    return content;
  }
};

// Get document icon by type
export const getDocumentIcon = (type: string) => {
  // Return string identifiers instead of JSX to fix TypeScript/ESBuild error
  switch (type) {
    case 'Acquisition':
      return 'acquisition-doc-icon';
    case 'Loan':
      return 'loan-doc-icon';
    default:
      return 'default-doc-icon';
  }
};
