import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, action, breadcrumbs, className = '' }: PageHeaderProps) {
  return (
    <div className={`mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between ${className}`}>
      <div className="min-w-0 flex-1">
        {breadcrumbs && <div className="mb-2">{breadcrumbs}</div>}
        <h2 className="text-xl font-bold leading-7 text-gray-900 sm:truncate sm:text-2xl md:text-3xl">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-gray-500">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex w-full flex-col gap-2 sm:mt-0 sm:w-auto sm:flex-row sm:items-center">
          {action}
        </div>
      )}
    </div>
  );
}
