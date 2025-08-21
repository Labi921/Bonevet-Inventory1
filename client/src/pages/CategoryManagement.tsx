import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Plus, Edit, Trash2, ArrowLeft, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Category {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function CategoryManagement() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true
  });

  // Fetch categories
  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData: any) => {
      return apiRequest('/api/categories', {
        method: 'POST',
        body: categoryData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setShowAddDialog(false);
      setFormData({ name: '', description: '', isActive: true });
      toast({
        title: "Success",
        description: "Category created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create category",
        variant: "destructive",
      });
    },
  });

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest(`/api/categories/${id}`, {
        method: 'PUT',
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setEditingCategory(null);
      toast({
        title: "Success",
        description: "Category updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update category",
        variant: "destructive",
      });
    },
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/categories/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setDeleteCategory(null);
      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete category",
        variant: "destructive",
      });
    },
  });

  const handleCreateCategory = () => {
    if (!formData.name.trim() || !formData.description.trim()) {
      toast({
        title: "Error",
        description: "Name and description are required",
        variant: "destructive",
      });
      return;
    }
    createCategoryMutation.mutate(formData);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description,
      isActive: category.isActive
    });
  };

  const handleUpdateCategory = () => {
    if (!editingCategory) return;
    if (!formData.name.trim() || !formData.description.trim()) {
      toast({
        title: "Error",
        description: "Name and description are required",
        variant: "destructive",
      });
      return;
    }
    updateCategoryMutation.mutate({ 
      id: editingCategory.id, 
      data: formData 
    });
  };

  const handleDeleteCategory = () => {
    if (!deleteCategory) return;
    deleteCategoryMutation.mutate(deleteCategory.id);
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', isActive: true });
    setEditingCategory(null);
    setShowAddDialog(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/inventory')}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Inventory
          </Button>
          <CardTitle className="text-xl">Category Management</CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            Manage inventory categories and their descriptions
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {Array(5).fill(0).map((_, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="h-5 bg-gray-200 animate-pulse rounded w-48"></div>
                    <div className="h-4 bg-gray-200 animate-pulse rounded w-full"></div>
                  </div>
                  <div className="flex space-x-2">
                    <div className="h-8 w-16 bg-gray-200 animate-pulse rounded"></div>
                    <div className="h-8 w-16 bg-gray-200 animate-pulse rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {categories && categories.length > 0 ? (
              categories.map((category) => (
                <div key={category.id} className="p-4 border rounded-lg hover:shadow-sm transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-lg">{category.name}</h3>
                        <Badge variant={category.isActive ? "default" : "secondary"}>
                          {category.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-gray-600 text-sm mb-2">{category.description}</p>
                      <p className="text-xs text-gray-400">
                        Created: {new Date(category.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditCategory(category)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteCategory(category)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">No categories found</p>
                <Button onClick={() => setShowAddDialog(true)} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Category
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Add/Edit Category Dialog */}
      <Dialog open={showAddDialog || !!editingCategory} onOpenChange={() => resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit Category' : 'Add New Category'}
            </DialogTitle>
            <DialogDescription>
              {editingCategory 
                ? 'Update the category information below.' 
                : 'Create a new category for inventory items.'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Category Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Computers & IT Equipment"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what items belong in this category..."
                className="mt-1"
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              <label htmlFor="isActive" className="text-sm">
                Active (available for selection)
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button 
              onClick={editingCategory ? handleUpdateCategory : handleCreateCategory}
              disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {editingCategory ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteCategory} onOpenChange={() => setDeleteCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteCategory?.name}"? This action cannot be undone.
              Existing items with this category will keep their current category assignment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteCategory}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}