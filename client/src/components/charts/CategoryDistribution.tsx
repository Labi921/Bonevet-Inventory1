import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CategoryData {
  category: string;
  count: number;
}

interface CategoryDistributionProps {
  data: CategoryData[];
  isLoading: boolean;
}

export default function CategoryDistribution({ data, isLoading }: CategoryDistributionProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-md font-medium">Inventory by Category</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i}>
                <div className="flex justify-between mb-1">
                  <div className="w-24 h-4 bg-gray-200 animate-pulse rounded"></div>
                  <div className="w-16 h-4 bg-gray-200 animate-pulse rounded"></div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-gray-300 h-2.5 rounded-full animate-pulse" style={{ width: '50%' }}></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare data for display
  const sortedData = [...data].sort((a, b) => b.count - a.count);
  const totalItems = sortedData.reduce((total, item) => total + item.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-md font-medium">Inventory by Category</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          {sortedData.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No data available</p>
          ) : (
            sortedData.map((item) => {
              const percentage = totalItems > 0 ? (item.count / totalItems) * 100 : 0;
              return (
                <div key={item.category}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{item.category}</span>
                    <span className="text-sm font-medium text-gray-700">{item.count} items</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
