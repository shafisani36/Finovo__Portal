export interface Department {
  id: number;
  company_id?: number;
  name: string;
  code: string | null;
  description: string | null;
  status: 'active' | 'archived' | 'draft' | string;
  manager_membership_id: number | null;
  manager?: {
    id: number;
    user: { id: number; name: string; email: string; avatar_url?: string };
  } | null;
  parent_department_id?: number | null;
  parent_department?: { id: number; name: string; code?: string | null } | null;
  child_departments?: Department[];
  members_count: number;
  employee_profiles_count: number;
  employment_records_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface MemberOption {
  id: number;
  user: { id?: number; name: string; email: string; avatar_url?: string };
}

export type DepartmentViewMode = 'grid' | 'table' | 'tree';
export type DepartmentFilterStatus = 'all' | 'active' | 'archived';
export type DepartmentFilterLead = 'all' | 'with_lead' | 'unassigned';
export type DepartmentFilterHierarchy = 'all' | 'top_level' | 'sub_units';
export type DepartmentSortBy = 'name_asc' | 'name_desc' | 'members_desc' | 'members_asc' | 'code_asc';

/**
 * Derives a clean 2-3 letter initials monogram for department avatars
 * ensuring long codes like HR-CORP, HR-REC, etc. never overflow fixed avatar squares.
 */
export const getDepartmentInitials = (name?: string, code?: string | null): string => {
  if (code) {
    const trimmed = code.trim().toUpperCase();
    // If clean 2-3 letter code without hyphen (e.g. ENG, PRD, OPS, HR, FIN, MKT)
    if (trimmed.length >= 2 && trimmed.length <= 3 && !trimmed.includes('-')) {
      return trimmed;
    }
    // If code has hyphen (e.g. HR-CORP, HR-REC, DEV-OPS), use prefix
    if (trimmed.includes('-')) {
      const prefix = trimmed.split('-')[0].trim();
      if (prefix.length >= 2 && prefix.length <= 3) {
        return prefix;
      }
    }
  }

  // Fallback: derive 2-letter initials from department name
  if (!name) return 'DP';
  const clean = name.replace(/[&/\\#,+()$~%.'":*?<>{}]/g, ' ').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};
