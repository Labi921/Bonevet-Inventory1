import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function RecentActivity() {
  const { data: activity = [], isLoading } = useQuery({
    queryKey: ['/api/activity/recent?limit=4'],
  });

  const formatActionBadge = (action: string) => {
    let className = "px-2 inline-flex text-xs leading-5 font-semibold rounded-full ";
    
    switch (action) {
      case 'Create':
        className += "bg-green-100 text-green-800";
        break;
      case 'Update':
        className += "bg-blue-100 text-blue-800";
        break;
      case 'Delete':
        className += "bg-red-100 text-red-800";
        break;
      default:
        className += "bg-gray-100 text-gray-800";
    }
    
    return (
      <span className={className}>{action}</span>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-md font-medium">Recent Inventory Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Item</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(4).fill(0).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div className="w-24 h-5 bg-gray-200 animate-pulse rounded"></div>
                    </TableCell>
                    <TableCell>
                      <div className="w-24 h-5 bg-gray-200 animate-pulse rounded"></div>
                    </TableCell>
                    <TableCell>
                      <div className="w-20 h-5 bg-gray-200 animate-pulse rounded"></div>
                    </TableCell>
                    <TableCell>
                      <div className="w-28 h-5 bg-gray-200 animate-pulse rounded"></div>
                    </TableCell>
                  </TableRow>
                ))
              ) : Array.isArray(activity) && activity.length > 0 ? (
                activity.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        <span className="font-medium text-gray-800">{log.entityId}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatActionBadge(log.action)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {log.userName || 'User #' + log.userId}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {format(new Date(log.timestamp), 'MMM dd, h:mm a')}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4 text-gray-500">
                    No recent activity found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4">
          <a href="/audit-logs" className="text-sm font-medium text-primary-600 hover:text-primary-800">
            View all activity →
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
