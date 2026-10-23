export type InvoiceStatus = 'draft' | 'issued' | 'partial' | 'paid' | 'void';

export interface Settings {
  id: number;
  name: string;
  subtitle: string;
  address: string;
  city: string;
  pincode: string;
  pan: string;
  contact: string;
  email: string;
  bank_name: string;
  bank_branch: string;
  bank_ac_no: string;
  bank_ifsc: string;
  upi_id: string;
  invoice_prefix: string;
  next_seq: number;
  updated_at: string;
}

export interface Product {
  id: number;
  sl_no: number;
  name: string;
  size: string;
  unit_paise: number;
  stock_qty: number;
  created_at: string;
  updated_at: string;
}

// Product rows joined with computed sales: sold = Σ qty on non-void invoice
// lines; avl = stock − sold. Computed in SQL, never stored.
export interface ProductRow extends Product {
  sold_qty: number;
  avl_qty: number;
}

// Stock movement ledger row (schema v4). kind=restock: receipt added via the
// Restock action; kind=edit: correction written by the product editor.
export interface Restock {
  id: number;
  product_id: number;
  kind: 'restock' | 'edit';
  delta: number;
  stock_after: number;
  unit_paise: number;
  note: string;
  created_at: string;
}

export interface InvoiceLine {
  id?: number;
  sno: number;
  product_id: number | null;
  description: string;
  size: string;
  qty: number;
  unit_paise: number;
  line_paise: number;
}

export interface PartySnapshot {
  party_name: string;
  party_address: string;
  party_city: string;
  party_pincode: string;
  party_mobile: string;
  party_email: string;
}

export interface Invoice extends PartySnapshot {
  id: number;
  invoice_no: string;
  status: InvoiceStatus;
  invoice_date: string; // ISO YYYY-MM-DD
  due_date: string | null;
  gross_paise: number;
  discount_percent: number;
  discount_paise: number;
  round_off_paise: number;
  total_paise: number;
  amount_in_words: string;
  upi_id: string;
  notes: string;
  has_shipping: number;
  ship_name: string;
  ship_address: string;
  ship_city: string;
  ship_pincode: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: number;
  payment_date: string;
  party_name: string;
  invoice_ids: string;
  mode: string;
  reference_no: string;
  amount_paise: number;
  remarks: string;
  created_at: string;
}

export interface Draft {
  id: number;
  draft_no: string;
  party_name: string;
  total_paise: number;
  items_count: number;
  payload_json: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceForm {
  party: PartySnapshot;
  invoiceDate: string;
  dueDate: string;
  discountPercent: number;
  lines: InvoiceLine[];
  notes: string;
  hasShipping: boolean;
  ship: {
    ship_name: string;
    ship_address: string;
    ship_city: string;
    ship_pincode: string;
  };
}

export interface InvoiceTotals {
  gross: number;
  discount: number;
  net: number;
  roundOff: number;
  total: number;
}

export interface AgingRow {
  invoice_id: number;
  party_name: string;
  invoice_no: string;
  due_date: string | null;
  total_paise: number;
  paid_paise: number;
}
