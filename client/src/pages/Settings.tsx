import { useRequireAuth } from '@/hooks/useAuth';
import { useState } from 'react';
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
import { useTheme } from '@/contexts/ThemeContext';
import { Monitor, Moon, Sun } from 'lucide-react';

// Settings form schema
const generalSettingsSchema = z.object({
  organizationName: z.string().min(1, "Organization name is required"),
  organizationPrefix: z.string().min(1, "Prefix is required").max(5, "Prefix cannot be longer than 5 characters"),
  contactEmail: z.string().email("Must be a valid email"),
  enableNotifications: z.boolean().default(true),
  enableAuditLogs: z.boolean().default(true)
});

function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Theme</label>
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant={theme === "light" ? "default" : "outline"}
          className="h-auto p-3 flex flex-col items-center gap-2"
          onClick={() => setTheme("light")}
        >
          <Sun className="h-4 w-4" />
          <span className="text-xs">Light</span>
        </Button>
        <Button
          variant={theme === "dark" ? "default" : "outline"}
          className="h-auto p-3 flex flex-col items-center gap-2"
          onClick={() => setTheme("dark")}
        >
          <Moon className="h-4 w-4" />
          <span className="text-xs">Dark</span>
        </Button>
        <Button
          variant={theme === "system" ? "default" : "outline"}
          className="h-auto p-3 flex flex-col items-center gap-2"
          onClick={() => setTheme("system")}
        >
          <Monitor className="h-4 w-4" />
          <span className="text-xs">System</span>
        </Button>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user } = useRequireAuth('admin'); // Require admin role
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('general');
  
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
  
  // Handle form submissions
  const onGeneralSubmit = (values: z.infer<typeof generalSettingsSchema>) => {
    console.log("General settings:", values);
    toast({
      title: "Settings Updated",
      description: "Your settings have been saved successfully."
    });
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
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
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
        
        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize the look and feel of the application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <ThemeSelector />
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Primary Color</label>
                  <div className="flex flex-wrap gap-2">
                    {['blue', 'green', 'purple', 'orange', 'red'].map((color) => (
                      <div 
                        key={color}
                        className={`w-8 h-8 rounded-full cursor-pointer border-2 ${color === 'blue' ? 'border-blue-600' : 'border-transparent'}`}
                        style={{ 
                          backgroundColor: 
                            color === 'blue' ? '#3B82F6' : 
                            color === 'green' ? '#10B981' : 
                            color === 'purple' ? '#8B5CF6' : 
                            color === 'orange' ? '#F59E0B' : 
                            '#EF4444' 
                        }}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button>Apply Changes</Button>
                </div>
              </div>
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
