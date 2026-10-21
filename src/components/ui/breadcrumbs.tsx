export { Breadcrumbs, type Crumb } from '@/components/sv2/breadcrumbs';

/**
 * Standard page heading: title, one-line description and an optional primary action.
 */
export function PageHeader({
  title,
  description,
  action,
  className = '',
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}>
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">{title}</h1>
        {description && <p className="text-xs text-[var(--color-text-secondary)] mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}
