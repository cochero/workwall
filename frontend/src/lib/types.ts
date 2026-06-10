export type Role = 'super' | 'team' | 'client';
export type ProjectType = 'social' | 'apar' | 'dev' | 'general';
export type Visibility = 'internal' | 'client';
export type FileStatus = 'draft' | 'review' | 'approved' | 'final';
export type FileCategory = 'image' | 'pdf' | 'doc' | 'sheet' | 'other';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  client_id: number | null;
  avatar_color?: string | null;
}

export interface ProjectLite {
  id: number;
  name: string;
  type: ProjectType;
  status: string;
  client_id: number;
  client_name: string;
  unread?: number;
  member_count?: number;
  description?: string | null;
}

export interface Member {
  user_id: number;
  member_role: string;
  name: string;
  email: string;
  user_role: Role;
  avatar_color?: string | null;
}

export interface WFile {
  id: number;
  project_id: number;
  post_id: number | null;
  uploader_id: number;
  uploader_name?: string;
  original_name: string;
  mime_type: string | null;
  category: FileCategory;
  size_bytes: number;
  version_group_id: number;
  version_no: number;
  status: FileStatus;
  visibility: Visibility;
  created_at: string;
  comment_count?: number;
  version_count?: number;
}

export interface FileVersion {
  id: number;
  version_no: number;
  original_name: string;
  size_bytes: number;
  status: FileStatus;
  created_at: string;
  uploader_name: string;
}

export interface CommentT {
  id: number;
  parent_type: 'post' | 'file';
  parent_id: number;
  author_id: number;
  author_name: string;
  author_role: Role;
  author_color?: string | null;
  body: string;
  created_at: string;
}

export interface Post {
  id: number;
  project_id: number;
  author_id: number;
  author_name: string;
  author_role: Role;
  author_color?: string | null;
  body: string;
  visibility: Visibility;
  pinned: 0 | 1;
  created_at: string;
  files: WFile[];
  comments?: CommentT[];
  comment_count?: number;
  project_name?: string;
  project_type?: ProjectType;
  client_name?: string;
}

export interface Notification {
  id: number;
  type: string;
  actor_name?: string | null;
  project_id: number | null;
  project_name?: string | null;
  ref_type?: string | null;
  ref_id?: number | null;
  preview?: string | null;
  is_read: 0 | 1;
  created_at: string;
}

export interface ProjectDetail {
  project: ProjectLite;
  members: Member[];
  my_role: string;
  my_user_role: Role;
}

export interface AdminClient {
  id: number;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  project_count?: number;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  client_id: number | null;
  client_name?: string | null;
  is_active: 0 | 1;
  last_login_at: string | null;
  avatar_color?: string | null;
}
