import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useRequireAuth } from '@/hooks/useAuth';
import { PlusCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import UserTable from '@/components/users/UserTable';
import UserForm from '@/components/users/UserForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Users() {
  useRequireAuth('admin'); // Require admin role
  
  const [location] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Check if we're on a sub-route
  const isNewUser = location === '/users/new';
  const isEditUser = location.startsWith('/users/edit/');
  const userId = isEditUser ? location.split('/users/edit/')[1] : null;
  
  // Fetch users
  const { data: users, isLoading } = useQuery({
    queryKey: ['/api/users'],
  });
  
  // Filter users based on search term
  const filteredUsers = users ? users.filter((user: any) => {
    return user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
           user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
           user.role.toLowerCase().includes(searchTerm.toLowerCase());
  }) : [];
  
  if (isNewUser) {
    return <UserForm />;
  }
  
  if (isEditUser && userId) {
    return <UserForm userId={userId} />;
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3">
        <CardTitle className="text-lg font-medium">User Management</CardTitle>
        <div className="mt-3 sm:mt-0">
          <Button asChild>
            <a href="/users/new">
              <PlusCircle className="h-4 w-4 mr-2" /> Add New User
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex justify-end mb-4">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search users..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <UserTable users={filteredUsers} isLoading={isLoading} />
      </CardContent>
    </Card>
  );
}
