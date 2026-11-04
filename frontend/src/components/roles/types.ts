export interface RoleItem {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  is_custom: boolean;
  permissions_count: number;
  active_members_count: number;
}

export interface PermissionItem {
  id: number;
  key: string;
  name: string;
  description: string | null;
}

export interface ModuleCatalog {
  module: string;
  module_title: string;
  total_permissions: number;
  permissions: PermissionItem[];
}

export interface TemporaryGrant {
  id: number;
  member: {
    id: number;
    user_name: string;
    user_email: string;
  };
  permission_key: string | null;
  role_name: string | null;
  grant_type?: 'grant' | 'restrict';
  is_permanent?: boolean;
  scope_type: string;
  scope_id: number | null;
  reason: string;
  is_active: boolean;
  granted_by: string;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

export interface AccessPreviewResult {
  is_allowed: boolean;
  permission_key: string;
  reason: string;
  matched_role: string | null;
  matched_grant: string | null;
  scope: {
    type: string;
    id: number | null;
  };
  decision_tree: Record<string, unknown>;
}

export interface WorkspaceMember {
  id: number;
  user?: {
    id: number;
    name: string;
    email: string;
  };
}

