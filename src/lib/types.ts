export type Role = "admin" | "sales" | "operations" | "accounts" | "management" | "client_admin" | "client_user"
export type LeadStage = "cold" | "warm" | "hot" | "client" | "regular_client"
export type LeadSource = "referral" | "website" | "direct" | "social_media" | "event" | "other"
export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired"
export type OrderStatus =
  | "created"
  | "confirmed"
  | "in_progress"
  | "procurement"
  | "printing"
  | "quality_check"
  | "ready_to_dispatch"
  | "dispatched"
  | "delivered"
  | "cancelled"
export type InvoiceStatus = "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "cancelled"
export type ProductStatus = "active" | "inactive" | "discontinued"
export type RequirementStatus = "active" | "closed" | "won" | "lost"

export interface Profile {
  id: string
  full_name: string
  email: string
  role: Role
  is_active: boolean
  company_id: string | null
  department_id: string | null
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  name: string
  industry: string | null
  website: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  owner_id: string | null
  status: string
  notes: string | null
  logo_path: string | null
  /** Company-specific sell margin %. Null = use org B2B / product / global hierarchy. */
  margin_percent: number | null
  /** If non-empty, portal client emails must match one of these domains. */
  allowed_email_domains: string[]
  gst_number?: string | null
  created_at: string
  updated_at: string
  // Joined
  owner?: Pick<Profile, "id" | "full_name" | "email"> | null
  _count?: { leads: number; requirements: number; orders: number }
}

export interface Branch {
  id: string
  company_id: string
  name: string
  city: string | null
  address: string | null
}

export interface Department {
  id: string
  company_id: string
  branch_id: string | null
  name: string
}

export interface Contact {
  id: string
  company_id: string
  branch_id: string | null
  department_id: string | null
  full_name: string
  email: string | null
  phone: string | null
  designation: string | null
  contact_type: string
  notes: string | null
  created_at: string
  // Joined
  company?: Pick<Company, "id" | "name" | "logo_path"> | null
}

export interface Lead {
  id: string
  company_id: string
  contact_id: string | null
  owner_id: string
  source: LeadSource | null
  stage: LeadStage
  estimated_value: number | null
  expected_conversion_date: string | null
  notes: string | null
  last_activity_at: string | null
  next_follow_up_at: string | null
  created_at: string
  updated_at: string
  // Joined
  company?: Pick<Company, "id" | "name" | "logo_path"> | null
  contact?: Pick<Contact, "id" | "full_name" | "designation"> | null
  owner?: Pick<Profile, "id" | "full_name"> | null
}

export interface Requirement {
  id: string
  name: string
  company_id: string
  contact_id: string | null
  lead_id: string | null
  owner_id: string
  branch_id: string | null
  quantity: number | null
  budget: number | null
  deadline: string | null
  delivery_city: string | null
  purpose: string | null
  department_name: string | null
  payment_terms: string | null
  description: string | null
  revenue_opportunity: number | null
  status: RequirementStatus
  created_at: string
  updated_at: string
  // Joined
  company?: Pick<Company, "id" | "name" | "logo_path"> | null
  contact?: Pick<Contact, "id" | "full_name" | "designation"> | null
  owner?: Pick<Profile, "id" | "full_name"> | null
}

export interface Category {
  id: string
  name: string
  slug: string | null
}

export interface Subcategory {
  id: string
  category_id: string
  name: string
}

export interface Brand {
  id: string
  name: string
}

export interface Supplier {
  id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  city: string | null
  category: string | null
  credit_period_days: number | null
  credit_limit: number | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface PrintingVendor {
  id: string
  name: string
  contact_person: string | null
  phone: string | null
  city: string | null
  service_type: string | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface CourierPartner {
  id: string
  name: string
  contact_person: string | null
  phone: string | null
  city: string | null
  tracking_supported: boolean | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface Product {
  id: string
  name: string
  sku: string
  brand_id: string | null
  category_id: string | null
  subcategory_id: string | null
  description: string | null
  price: number
  moq: number | null
  image_url: string | null
  status: ProductStatus
  supplier_cost: number | null
  internal_margin: number | null
  internal_notes: string | null
  visibility: string | null
  catalogue_access: string
  supplier_id: string | null
  created_at: string
  updated_at: string
  // Joined
  category?: Pick<Category, "id" | "name"> | null
  brand?: Pick<Brand, "id" | "name"> | null
  supplier?: Pick<Supplier, "id" | "name"> | null
}

export interface ProductVariant {
  id: string
  product_id: string
  size: string | null
  colour: string | null
  sku_suffix: string | null
}

export interface Quotation {
  id: string
  quotation_number: string
  requirement_id: string | null
  company_id: string
  contact_id: string | null
  owner_id: string
  campaign_id: string | null
  discount_percent: number
  tax_percent: number
  subtotal: number
  discount_amount: number
  tax_amount: number
  total: number
  valid_until: string | null
  status: QuotationStatus
  notes: string | null
  client_comment: string | null
  responded_at: string | null
  created_at: string
  updated_at: string
  // Joined
  company?: Pick<Company, "id" | "name" | "logo_path"> | null
  contact?: Pick<Contact, "id" | "full_name" | "designation"> | null
  owner?: Pick<Profile, "id" | "full_name"> | null
  requirement?: Pick<Requirement, "id" | "name"> | null
  items?: QuotationItem[]
}

export interface QuotationItem {
  id: string
  quotation_id: string
  product_id: string
  quantity: number
  unit_price: number
  line_total: number
  product?: Pick<Product, "id" | "name" | "sku" | "image_url"> | null
}

export interface Order {
  id: string
  order_number: string
  company_id: string
  contact_id: string | null
  quotation_id: string | null
  owner_id: string
  operations_user_id: string | null
  assigned_to: string | null
  supplier_id: string | null
  printing_vendor_id: string | null
  courier_partner_id: string | null
  requirement_id: string | null
  order_value: number
  po_number: string | null
  expected_delivery_date: string | null
  actual_delivery_date: string | null
  dispatch_date: string | null
  tracking_number: string | null
  status: OrderStatus
  notes: string | null
  next_action: string | null
  stage_due_at: string | null
  product_cost: number | null
  printing_cost: number | null
  courier_cost: number | null
  other_cost: number | null
  total_cost: number | null
  gross_profit: number | null
  priority: number | null
  current_department_id: string | null
  campaign_id: string | null
  created_at: string
  updated_at: string
  // Joined
  company?: Pick<Company, "id" | "name" | "logo_path"> | null
  contact?: Pick<Contact, "id" | "full_name" | "designation"> | null
  owner?: Pick<Profile, "id" | "full_name"> | null
  supplier?: Pick<Supplier, "id" | "name"> | null
  printing_vendor?: Pick<PrintingVendor, "id" | "name"> | null
  courier_partner?: Pick<CourierPartner, "id" | "name"> | null
  quotation?: Pick<Quotation, "id" | "quotation_number"> | null
  requirement?: Pick<Requirement, "id" | "name"> | null
  items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  line_total: number
  product?: Pick<Product, "id" | "name" | "sku" | "image_url"> | null
}

export interface OrderStatusHistory {
  id: string
  order_id: string
  from_status: string | null
  to_status: string
  changed_by: string
  note: string | null
  changed_at?: string
  created_at?: string
  changer?: Pick<Profile, "id" | "full_name"> | null
}

export interface Invoice {
  id: string
  invoice_number: string
  order_id: string | null
  company_id: string
  invoice_date: string
  due_date: string | null
  amount: number
  status: InvoiceStatus
  notes: string | null
  created_at: string
  updated_at: string
  // Joined
  company?: Pick<Company, "id" | "name"> | null
  order?: Pick<Order, "id" | "order_number"> | null
  payments?: Payment[]
}

export interface Payment {
  id: string
  invoice_id: string
  payment_date: string
  amount: number
  method: string
  reference: string | null
  notes: string | null
  created_by: string
  created_at: string
  invoice?: Pick<Invoice, "id" | "invoice_number"> | null
}

export interface Payable {
  id: string
  vendor_type: string
  vendor_name: string
  order_id: string | null
  amount: number
  amount_paid: number
  due_date: string | null
  status: string
  notes: string | null
  created_by: string
  created_at: string
  order?: Pick<Order, "id" | "order_number"> | null
}

export interface Activity {
  id: string
  type: string
  company_id: string | null
  contact_id: string | null
  lead_id: string | null
  requirement_id: string | null
  quotation_id: string | null
  order_id: string | null
  notes: string | null
  created_by: string
  created_at: string
  creator?: Pick<Profile, "id" | "full_name"> | null
}

export interface Mockup {
  id: string
  requirement_id: string | null
  order_id: string | null
  product_id: string | null
  file_path: string
  file_name: string
  uploaded_by: string
  created_at: string
}

export interface SampleStock {
  id: string
  product_id: string
  in_office: number
  with_client: number
  pending_supplier: number
  unit_cost: number | null
  product?: Pick<Product, "id" | "name" | "sku" | "image_url"> | null
}

export interface SampleMovement {
  id: string
  product_id: string
  quantity: number
  from_holder: string
  to_holder: string
  company_id: string | null
  requirement_id: string | null
  cost: number | null
  note: string | null
  created_by: string
  created_at: string
}

export interface Goal {
  id: string
  title: string
  period_type: string
  period_start: string
  metric: string
  target: number
  owner_id: string
  created_by: string
  created_at: string
  owner?: Pick<Profile, "id" | "full_name"> | null
}

export interface Task {
  id: string
  title: string
  description: string | null
  order_id: string | null
  department_id: string | null
  company_id: string | null
  requirement_id: string | null
  assigned_to: string | null
  created_by: string
  due_at: string | null
  completed_at: string | null
  status: string
  priority: number | null
  created_at: string
  assignee?: Pick<Profile, "id" | "full_name"> | null
}

export interface Announcement {
  id: string
  title: string
  body: string | null
  created_by: string
  created_at: string
  creator?: Pick<Profile, "id" | "full_name"> | null
}

export interface Notification {
  id: string
  user_id: string
  title: string
  body: string | null
  link: string | null
  read: boolean
  created_at: string
}

export interface CompanyProductAccess {
  company_id: string
  product_id: string
}
