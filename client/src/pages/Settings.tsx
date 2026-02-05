import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';

// Settings form schema
const generalSettingsSchema = z.object({
  organizationName: z.string().min(1, "Organization name is required"),
  organizationPrefix: z.string().min(1, "Prefix is required").max(10, "Prefix cannot be longer than 10 characters"),
  contactEmail: z.string().email("Must be a valid email"),
  enableNotifications: z.boolean().default(true),
  enableAuditLogs: z.boolean().default(true)
});


export default function Settings() {
  const { user } = useAuth(); // Use general auth hook instead of role-specific
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('general');
  
  // Check if user has permission to access settings (Admin or Super Admin only)
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }
  
  // Fetch settings from backend
  const { data: settings, isLoading: settingsLoading } = useQuery<Record<string, string>>({
    queryKey: ['/api/settings'],
  });

  // General settings form
  const generalForm = useForm<z.infer<typeof generalSettingsSchema>>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: {
      organizationName: 'BONEVET Gjakova',
      organizationPrefix: 'BVGJK',
      contactEmail: 'admin@bonevet.org',
      enableNotifications: true,
      enableAuditLogs: true
    }
  });

  // Update form when settings are loaded
  useEffect(() => {
    if (settings) {
      generalForm.reset({
        organizationName: settings.organizationName || 'BONEVET Gjakova',
        organizationPrefix: settings.organizationPrefix || 'BVGJK',
        contactEmail: settings.contactEmail || 'admin@bonevet.org',
        enableNotifications: settings.enableNotifications === 'true',
        enableAuditLogs: settings.enableAuditLogs === 'true'
      });
    }
  }, [settings, generalForm]);

  // Save settings mutation
  const saveSettings = useMutation({
    mutationFn: async (values: z.infer<typeof generalSettingsSchema>) => {
      const response = await apiRequest('PUT', '/api/settings', values);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: "Settings Updated",
        description: "Your settings have been saved successfully."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Handle form submissions
  const onGeneralSubmit = (values: z.infer<typeof generalSettingsSchema>) => {
    saveSettings.mutate(values);
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your application settings and preferences.
        </p>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Manage your basic organization settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Form {...generalForm}>
                <form onSubmit={generalForm.handleSubmit(onGeneralSubmit)} className="space-y-4">
                  <FormField
                    control={generalForm.control}
                    name="organizationName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter organization name" {...field} />
                        </FormControl>
                        <FormDescription>
                          This is the name that appears on documents and reports
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={generalForm.control}
                    name="organizationPrefix"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization Prefix</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter prefix" maxLength={5} {...field} />
                        </FormControl>
                        <FormDescription>
                          This prefix is used for generating unique item IDs (e.g., BVGJK0001)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={generalForm.control}
                    name="contactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Enter contact email" {...field} />
                        </FormControl>
                        <FormDescription>
                          Primary contact email for notifications and reports
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={generalForm.control}
                    name="enableAuditLogs"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Enable Audit Logs
                          </FormLabel>
                          <FormDescription>
                            Automatically track all user actions
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
                  
                  <div className="flex justify-end">
                    <Button type="submit">Save Changes</Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Manage your notification preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-lg border border-gray-200 divide-y">
                  <div className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">Loan Reminders</p>
                      <p className="text-sm text-gray-500">Receive notifications when loans are due</p>
                    </div>
                    <Switch defaultChecked={true} />
                  </div>
                  
                  <div className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">Inventory Alerts</p>
                      <p className="text-sm text-gray-500">Notifications for low stock or maintenance</p>
                    </div>
                    <Switch defaultChecked={true} />
                  </div>
                  
                  <div className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">Document Updates</p>
                      <p className="text-sm text-gray-500">Alerts when documents need signatures</p>
                    </div>
                    <Switch defaultChecked={true} />
                  </div>
                  
                  <div className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">User Activity</p>
                      <p className="text-sm text-gray-500">Notifications about user actions</p>
                    </div>
                    <Switch defaultChecked={false} />
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button>Save Preferences</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>
                Configure advanced system settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Data Management</h3>
                  <div className="rounded-lg border border-gray-200 p-4 space-y-4">
                    <div className="space-y-1">
                      <p className="font-medium">Data Export</p>
                      <p className="text-sm text-gray-500">Export all inventory data to CSV or JSON format</p>
                      <div className="flex space-x-2 mt-2">
                        <Button variant="outline" size="sm">Export as CSV</Button>
                        <Button variant="outline" size="sm">Export as JSON</Button>
                      </div>
                    </div>
                    
                    <div className="space-y-1 pt-2 border-t border-gray-200">
                      <p className="font-medium">Database Operations</p>
                      <p className="text-sm text-gray-500">Perform maintenance tasks on the database</p>
                      <div className="flex space-x-2 mt-2">
                        <Button variant="outline" size="sm">Optimize Database</Button>
                        <Button variant="destructive" size="sm">Clear All Data</Button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">System Configuration</h3>
                  <div className="rounded-lg border border-gray-200 p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">API Rate Limit</label>
                        <Input type="number" defaultValue={100} min={10} max={1000} className="mt-1" />
                        <p className="text-xs text-gray-500 mt-1">Maximum API requests per minute</p>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium">Session Timeout</label>
                        <Input type="number" defaultValue={30} min={5} max={120} className="mt-1" />
                        <p className="text-xs text-gray-500 mt-1">Minutes until session expires</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button variant="outline" className="mr-2">Reset to Defaults</Button>
                  <Button>Save Configuration</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
