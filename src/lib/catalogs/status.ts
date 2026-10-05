/** User-facing label for campaigns.status. The column is unchanged. */
export function catalogStatusLabel(status: string | null | undefined) {
  if (!status || status === 'planning') return 'Draft'
  if (status === 'published_to_client') return 'Published'
  if (status === 'order_ready') return 'Order ready'
  if (status === 'closed') return 'Closed'
  return status.replace(/_/g, ' ')
}
