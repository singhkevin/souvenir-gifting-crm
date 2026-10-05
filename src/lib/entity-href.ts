const ENTITY_PATH: Record<string, (id: string) => string> = {
  orders: (id) => `/crm/orders/${id}`,
  leads: (id) => `/crm/leads/${id}`,
  requirements: (id) => `/crm/requirements/${id}`,
  quotations: (id) => `/crm/quotations/${id}`,
  products: (id) => `/crm/products/${id}`,
  companies: (id) => `/crm/companies/${id}`,
  invoices: (id) => `/crm/invoices/${id}`,
  campaigns: (id) => `/crm/catalogs/${id}`,
  catalogs: (id) => `/crm/catalogs/${id}`,
  tasks: () => `/crm/tasks`,
  contacts: () => `/crm/contacts`,
  mockups: () => `/crm/mockups`,
  payments: () => `/crm/payments`,
  goals: () => `/crm/goals`,
}

export function entityHref(entity?: string | null, entityId?: string | null): string | null {
  if (!entity || !entityId) return null
  const builder = ENTITY_PATH[entity]
  if (!builder) return null
  return builder(entityId)
}

export function describeAudit(action: string, entity: string) {
  const verb =
    action === 'create' ? 'created' :
    action === 'delete' ? 'deleted' :
    action === 'status_change' ? 'changed status of' :
    action === 'assignment_change' ? 'reassigned' :
    'updated'
  return `${verb} ${entity.replace(/_/g, ' ')}`
}
