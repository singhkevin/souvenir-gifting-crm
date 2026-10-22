import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  color?: 'primary' | 'success' | 'warning' | 'error' | 'neutral';
  className?: string;
}

const colorStyles = {
  primary: 'bg-blue-50 text-blue-600',
  success: 'bg-green-50 text-green-600',
  warning: 'bg-orange-50 text-orange-600',
  error: 'bg-red-50 text-red-600',
  neutral: 'bg-gray-50 text-gray-600',
};

export function KpiCard({ label, value, icon: Icon, trend, color = 'primary', className = '' }: KpiCardProps) {
  const iconStyle = colorStyles[color];

  return (
    <div className={`bg-white border border-gray-200 p-5 ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500 truncate">{label}</p>
        <div className={`p-2 ${iconStyle}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-4">
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
        {trend && (
          <div className="mt-1 flex items-center text-sm">
            {trend.value >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
            )}
            <span className={trend.value >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
              {Math.abs(trend.value)}%
            </span>
            <span className="text-gray-500 ml-2">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
