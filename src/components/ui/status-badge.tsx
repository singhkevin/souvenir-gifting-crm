import React from 'react';

export type StatusVariant = 
  | 'received' | 'planning' | 'supplier_coordination' | 'printing' | 'quality_check' | 'dispatch' | 'delivered'
  | 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
  | 'issued' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
  | 'cold' | 'warm' | 'hot' | 'client' | 'regular_client'
  | 'active' | 'inactive' | 'closed' | 'won' | 'lost';

const statusStyles: Record<string, string> = {
  // Order
  received: 'bg-blue-100 text-blue-800',
  created: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-indigo-100 text-indigo-800',
  procurement: 'bg-orange-100 text-orange-800',
  planning: 'bg-purple-100 text-purple-800',
  supplier_coordination: 'bg-orange-100 text-orange-800',
  printing: 'bg-amber-100 text-amber-800',
  mockup: 'bg-amber-100 text-amber-800',
  client_approval: 'bg-indigo-100 text-indigo-800',
  production: 'bg-orange-100 text-orange-800',
  packaging_qc: 'bg-yellow-100 text-yellow-800',
  quality_check: 'bg-yellow-100 text-yellow-800',
  ready_to_dispatch: 'bg-teal-100 text-teal-800',
  dispatch: 'bg-indigo-100 text-indigo-800',
  dispatched: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  // Quotation/Invoice
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-800',
  issued: 'bg-blue-100 text-blue-800',
  partially_paid: 'bg-amber-100 text-amber-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
  // Lead stages
  cold: 'bg-gray-100 text-gray-800',
  warm: 'bg-blue-100 text-blue-800',
  hot: 'bg-orange-100 text-orange-800',
  client: 'bg-green-100 text-green-800',
  regular_client: 'bg-emerald-100 text-emerald-800',
  // Company/general
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  closed: 'bg-gray-100 text-gray-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
};

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  className?: string;
}

export function StatusBadge({ status, variant, className = '' }: StatusBadgeProps) {
  const v = variant || status.toLowerCase().replace(/\s+/g, '_');
  const style = statusStyles[v] || 'bg-gray-100 text-gray-800';
  
  const label = status
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style} ${className}`}>
      {label}
    </span>
  );
}
