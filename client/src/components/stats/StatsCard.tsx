import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type StatVariant = 'primary' | 'success' | 'warning' | 'destructive';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  variant?: StatVariant;
  footer?: ReactNode;
  className?: string;
}

const getBgColor = (variant: StatVariant) => {
  switch (variant) {
    case 'primary': return 'bg-primary-50 text-primary-600';
    case 'success': return 'bg-green-50 text-green-600';
    case 'warning': return 'bg-amber-50 text-amber-600';
    case 'destructive': return 'bg-red-50 text-red-600';
    default: return 'bg-primary-50 text-primary-600';
  }
};

export default function StatsCard({
  title,
  value,
  icon,
  variant = 'primary',
  footer,
  className
}: StatsCardProps) {
  return (
    <Card className={cn("border border-gray-200", className)}>
      <CardContent className="p-4">
        <div className="flex items-center">
          <div className={cn("p-3 rounded-full", getBgColor(variant))}>
            {icon}
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
          </div>
        </div>
        {footer && <div className="mt-2">{footer}</div>}
      </CardContent>
    </Card>
  );
}
