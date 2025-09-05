import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  PlusCircle, 
  BookOpen, 
  Video, 
  FileText, 
  Shield, 
  Download, 
  ExternalLink,
  Edit,
  Trash2,
  Play
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

const resourceSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  type: z.enum(['manual', 'video', 'document', 'rules']),
  fileUrl: z.string().url('Valid URL required').optional().or(z.literal('')),
  videoUrl: z.string().url('Valid YouTube URL required').optional().or(z.literal('')),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  pdfFile: z.any().optional(), // For file uploads
});

type ResourceFormData = z.infer<typeof resourceSchema>;

interface Resource {
  id: number;
  title: string;
  description?: string;
  type: string;
  fileUrl?: string;
  videoUrl?: string;
  category?: string;
  tags?: string[];
  uploadedBy: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const RESOURCE_TYPE_LABELS = {
  manual: 'Equipment Manual',
  video: 'Video Tutorial',
  document: 'General Document',
  rules: 'Rules & Regulations',
};

const RESOURCE_TYPE_ICONS = {
  manual: BookOpen,
  video: Video,
  document: FileText,
  rules: Shield,
};

export default function Resources() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  // Fetch resources
  const { data: resources = [], isLoading, refetch } = useQuery<Resource[]>({
    queryKey: ['/api/resources'],
    staleTime: 0, // Always refetch
    gcTime: 0, // Don't cache (renamed from cacheTime)
  });

  // Create resource mutation
  const createMutation = useMutation({
    mutationFn: async (data: ResourceFormData) => {
      const formData = new FormData();
      
      // Always ensure tags is handled as array
      const tagsArray = Array.isArray(data.tags) ? data.tags : (data.tags && data.tags !== '' ? [data.tags] : []);
      formData.append('tags', JSON.stringify(tagsArray));
      
      // Add other text fields
      Object.entries(data).forEach(([key, value]) => {
        if (key === 'pdfFile' && value instanceof File) {
          formData.append('pdfFile', value);
        } else if (key !== 'pdfFile' && key !== 'tags' && value !== undefined && value !== '') {
          formData.append(key, String(value));
        }
      });

      const response = await fetch('/api/resources', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create resource');
      }

      return response.json();
    },
    onSuccess: async () => {
      toast({
        title: 'Success',
        description: 'Resource created successfully',
      });
      // Force refetch instead of just invalidating
      await refetch();
      setIsCreateOpen(false);
      createForm.reset();
      // Switch to the 'all' tab to show the newly created resource
      setActiveTab('all');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create resource',
        variant: 'destructive',
      });
    },
  });

  // Update resource mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ResourceFormData> }) => {
      const formData = new FormData();
      
      // Always ensure tags is handled as array
      const tagsArray = Array.isArray(data.tags) ? data.tags : (data.tags && data.tags !== '' ? [data.tags] : []);
      formData.append('tags', JSON.stringify(tagsArray));
      
      // Add other text fields
      Object.entries(data).forEach(([key, value]) => {
        if (key === 'pdfFile' && value instanceof File) {
          formData.append('pdfFile', value);
        } else if (key !== 'pdfFile' && key !== 'tags' && value !== undefined && value !== '') {
          formData.append(key, String(value));
        }
      });

      const response = await fetch(`/api/resources/${id}`, {
        method: 'PUT',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update resource');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Resource updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
      setEditingResource(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update resource',
        variant: 'destructive',
      });
    },
  });

  // Delete resource mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/resources/${id}`);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Resource deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete resource',
        variant: 'destructive',
      });
    },
  });

  const createForm = useForm<ResourceFormData>({
    resolver: zodResolver(resourceSchema),
    defaultValues: {
      title: '',
      description: '',
      type: 'manual',
      fileUrl: '',
      videoUrl: '',
      category: '',
      tags: [],
    },
  });

  const editForm = useForm<Partial<ResourceFormData>>({
    resolver: zodResolver(resourceSchema.partial()),
  });

  const onCreateSubmit = (data: ResourceFormData) => {
    // Clean up empty strings
    const cleanData = {
      ...data,
      fileUrl: data.fileUrl || undefined,
      videoUrl: data.videoUrl || undefined,
      category: data.category || undefined,
    };
    createMutation.mutate(cleanData);
  };

  const onEditSubmit = (data: Partial<ResourceFormData>) => {
    if (!editingResource) return;
    const cleanData = {
      ...data,
      fileUrl: data.fileUrl || undefined,
      videoUrl: data.videoUrl || undefined,
      category: data.category || undefined,
    };
    updateMutation.mutate({ id: editingResource.id, data: cleanData });
  };

  const handleEdit = (resource: Resource) => {
    setEditingResource(resource);
    editForm.reset({
      title: resource.title,
      description: resource.description,
      type: resource.type as any,
      fileUrl: resource.fileUrl || '',
      videoUrl: resource.videoUrl || '',
      category: resource.category || '',
      tags: resource.tags || [],
    });
  };

  const handleDelete = (resource: Resource) => {
    if (confirm(`Are you sure you want to delete "${resource.title}"?`)) {
      deleteMutation.mutate(resource.id);
    }
  };

  const filteredResources = (resources || []).filter((resource: Resource) => {
    if (activeTab === 'all') return true;
    return resource.type === activeTab;
  });

  // Add debugging info
  console.log('Total resources:', (resources || []).length);
  console.log('Active tab:', activeTab);
  console.log('Filtered resources:', filteredResources.length);
  console.log('Resources data:', resources);

  const getResourceTypeColor = (type: string) => {
    switch (type) {
      case 'manual':
        return 'bg-blue-100 text-blue-800';
      case 'video':
        return 'bg-green-100 text-green-800';
      case 'document':
        return 'bg-purple-100 text-purple-800';
      case 'rules':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getYouTubeEmbedUrl = (url: string) => {
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return videoId ? `https://www.youtube.com/embed/${videoId[1]}` : null;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Resource Library
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Access equipment manuals, video tutorials, and BONEVET rules & regulations
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Resource
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Resource</DialogTitle>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={createForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(RESOURCE_TYPE_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={createForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={createForm.control}
                      name="fileUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>File URL (PDF, etc.)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="https://example.com/manual.pdf" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="videoUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>YouTube URL</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="https://youtube.com/watch?v=..." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={createForm.control}
                    name="pdfFile"
                    render={({ field: { onChange, value, ...field } }) => (
                      <FormItem>
                        <FormLabel>Upload PDF File (Alternative to URL)</FormLabel>
                        <FormControl>
                          <Input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              onChange(file);
                            }}
                            data-testid="input-pdf-file"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-sm text-gray-500">
                          Upload a PDF file if you don't have a URL. Max size: 10MB.
                        </p>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Equipment Category (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., 3D Printers, Electronics" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? 'Creating...' : 'Create Resource'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All Resources</TabsTrigger>
          <TabsTrigger value="manual">Manuals</TabsTrigger>
          <TabsTrigger value="video">Videos</TabsTrigger>
          <TabsTrigger value="document">Documents</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array(6).fill(0).map((_, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="w-full h-32 bg-gray-200 animate-pulse rounded mb-4"></div>
                    <div className="w-3/4 h-5 bg-gray-200 animate-pulse rounded mb-2"></div>
                    <div className="w-1/2 h-4 bg-gray-200 animate-pulse rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredResources.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredResources.map((resource: Resource) => {
                const IconComponent = RESOURCE_TYPE_ICONS[resource.type as keyof typeof RESOURCE_TYPE_ICONS];
                return (
                  <Card key={resource.id} className="group hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      {/* Video Preview */}
                      {resource.type === 'video' && resource.videoUrl && (
                        <div className="mb-4 relative">
                          <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                            {getYouTubeEmbedUrl(resource.videoUrl) ? (
                              <iframe
                                src={getYouTubeEmbedUrl(resource.videoUrl)!}
                                className="w-full h-full"
                                allowFullScreen
                                title={resource.title}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Play className="h-12 w-12 text-gray-400" />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Resource Info */}
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <IconComponent className="h-5 w-5 text-gray-600 flex-shrink-0" />
                            <h3 className="font-medium text-sm leading-tight">{resource.title}</h3>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(resource)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(resource)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        <Badge className={getResourceTypeColor(resource.type)}>
                          {RESOURCE_TYPE_LABELS[resource.type as keyof typeof RESOURCE_TYPE_LABELS]}
                        </Badge>

                        {resource.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {resource.description}
                          </p>
                        )}

                        {resource.category && (
                          <p className="text-xs text-muted-foreground">
                            Category: {resource.category}
                          </p>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-2">
                          {resource.fileUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="flex-1"
                            >
                              <a
                                href={resource.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </a>
                            </Button>
                          )}
                          {resource.videoUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="flex-1"
                            >
                              <a
                                href={resource.videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Watch
                              </a>
                            </Button>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Added {new Date(resource.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Resources Found</h3>
                <p className="text-gray-500 mb-4">
                  {activeTab === 'all' 
                    ? 'No resources have been added yet.' 
                    : `No ${RESOURCE_TYPE_LABELS[activeTab as keyof typeof RESOURCE_TYPE_LABELS].toLowerCase()} found.`}
                </p>
                <Button onClick={() => setIsCreateOpen(true)}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add First Resource
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Resource Dialog */}
      <Dialog open={!!editingResource} onOpenChange={() => setEditingResource(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Resource</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(RESOURCE_TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="fileUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>File URL (PDF, etc.)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://example.com/manual.pdf" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="videoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>YouTube URL</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://youtube.com/watch?v=..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="pdfFile"
                render={({ field: { onChange, value, ...field } }) => (
                  <FormItem>
                    <FormLabel>Upload New PDF File (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          onChange(file);
                        }}
                        data-testid="input-pdf-file-edit"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-sm text-gray-500">
                      Upload a PDF file to replace existing URL. Max size: 10MB.
                    </p>
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipment Category (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., 3D Printers, Electronics" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingResource(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Updating...' : 'Update Resource'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}