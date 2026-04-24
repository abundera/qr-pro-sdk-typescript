export interface Code {
  id: string;
  slug: string;
  destination_url: string;
  label?: string;
  tags?: string[];
  group_id?: string | null;
  created_at: string;
  updated_at: string;
  scan_count?: number;
  last_scan_at?: string | null;
  active: boolean;
  short_url: string;
}

export interface CodeCreate {
  destination_url: string;
  slug?: string;
  label?: string;
  tags?: string[];
  group_id?: string | null;
}

export interface CodePatch {
  destination_url?: string;
  label?: string;
  tags?: string[];
  group_id?: string | null;
  active?: boolean;
}

export interface Pagination {
  cursor?: string | null;
  limit?: number;
  has_more?: boolean;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  code_count?: number;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
}

export interface Analytics {
  code_id: string;
  total_scans: number;
  unique_days: number;
  by_day: Array<{ date: string; scans: number }>;
  by_country: Array<{ country: string; scans: number }>;
  by_device: Array<{ device_class: string; scans: number }>;
}

export interface ListResult<T> {
  data: T[];
  pagination: Pagination;
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  request_id?: string;
}
