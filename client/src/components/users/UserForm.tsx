import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useRequireAuth } from '@/hooks/useAuth';
import { ArrowLeft, Save } from 'lucide-react';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// User form schema
const userSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  role: z.string().min(1, "Role is required"),
  active: z.boolean().default(true),
});

// Edit user schema (password optional)
const editUserSchema = userSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
});

interface UserFormProps {
  userId?: string;
}

export default function UserForm({ userId }: UserFormProps) {
  useRequireAuth('admin'); // Ensure only admins can access this page
  
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditMode, setIsEditMode] = useState(!!userId);
  
  // Schema based on edit mode
  const formSchema = isEditMode ? editUserSchema : userSchema;
  
  // Fetch user details if in edit mode
  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['/api/users', userId],
    queryFn: async () => {
      if (!userId) return null;
      const response = await fetch(`/api/users/${userId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch user');
      return response.json();
    },
    enabled: !!userId,
  });
  
  // Set up form with default values
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      password: '',
      name: '',
      email: '',
      role: 'user',
      active: true,
    },
  });
  
  // Update form values when user data is loaded
  useEffect(() => {
    if (userData) {
      form.reset({
        username: userData.username,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        active: userData.active,
        // Don't set password in edit mode
      });
    }
  }, [userData, form]);
  
  // Create user mutation
  const createUser = useMutation({
    mutationFn: async (data: z.infer<typeof userSchema>) => {
      const response = await apiRequest('POST', '/api/users', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity/recent'] });
      
      toast({
        title: 'User Created',
        description: 'The user has been created successfully.',
      });
      
      navigate('/users');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to create user. The username may already be taken.',
        variant: 'destructive',
      });
      console.error('Error creating user:', error);
    },
  });
  
  // Update user mutation
  const updateUser = useMutation({
    mutationFn: async (data: Partial<z.infer<typeof editUserSchema>>) => {
      const response = await apiRequest('PUT', `/api/users/${userId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity/recent'] });
      
      toast({
        title: 'User Updated',
        description: 'The user has been updated successfully.',
      });
      
      navigate('/users');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update user. Please try again.',
        variant: 'destructive',
      });
      console.error('Error updating user:', error);
    },
  });
  
  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (isEditMode) {
      // Remove password if it's empty in edit mode
      const updateData = { ...values };
      if (!updateData.password) {
        delete updateData.password;
      }
      updateUser.mutate(updateData);
    } else {
      createUser.mutate(values);
    }
  };
  
  if (userLoading && isEditMode) {
    return (
      <Card>
        <CardHeader>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/users')}
            className="w-fit mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Users
          </Button>
          <CardTitle>Loading User...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <div className="w-24 h-5 bg-gray-200 animate-pulse rounded"></div>
                <div className="w-full h-10 bg-gray-200 animate-pulse rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1.5">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/users')}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Users
          </Button>
          <CardTitle>{isEditMode ? 'Edit User' : 'Add New User'}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter username" 
                        {...field} 
                        disabled={isEditMode} // Username can't be changed in edit mode
                      />
                    </FormControl>
                    <FormDescription>
                      {isEditMode ? "Username cannot be changed" : "Username must be unique"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{isEditMode ? 'New Password' : 'Password *'}</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder={isEditMode ? "Leave blank to keep current password" : "Enter password"} 
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {isEditMode ? "Leave blank to keep current password" : "Minimum 6 characters"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Enter email address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select user role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Admin users have full access to the system
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Active Status
                      </FormLabel>
                      <FormDescription>
                        Inactive users cannot log in to the system
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/users')}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createUser.isPending || updateUser.isPending}
              >
                {(createUser.isPending || updateUser.isPending) ? 'Saving...' : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {isEditMode ? 'Update User' : 'Create User'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
