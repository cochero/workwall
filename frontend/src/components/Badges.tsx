import { Eye, Lock } from 'lucide-react';
import type { FileStatus, ProjectType, Visibility } from '../lib/types';

export function VisibilityPill({ v }: { v: Visibility }) {
  if (v === 'client') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
        <Eye size={11} /> Client visible
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
      <Lock size={11} /> Internal
    </span>
  );
}

const STATUS_STYLES: Record<FileStatus, string> = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  review: 'bg-blue-50 text-blue-700 border-blue-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  final: 'bg-violet-50 text-violet-700 border-violet-200'
};

const STATUS_LABELS: Record<FileStatus, string> = {
  draft: 'Draft',
  review: 'In review',
  approved: 'Approved',
  final: 'Final'
};

export function StatusPill({ s }: { s: FileStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[s]}`}>
      {STATUS_LABELS[s]}
    </span>
  );
}

export const TYPE_LABELS: Record<ProjectType, string> = {
  social: 'Social media',
  apar: 'AP/AR',
  dev: 'Development',
  general: 'General'
};

const TYPE_STYLES: Record<ProjectType, string> = {
  social: 'bg-violet-50 text-violet-700 border-violet-200',
  apar: 'bg-amber-50 text-amber-700 border-amber-200',
  dev: 'bg-teal-50 text-teal-700 border-teal-200',
  general: 'bg-gray-100 text-gray-600 border-gray-200'
};

export const TYPE_DOT: Record<ProjectType, string> = {
  social: 'bg-violet-500',
  apar: 'bg-amber-500',
  dev: 'bg-teal-500',
  general: 'bg-gray-400'
};

export function TypeBadge({ t }: { t: ProjectType }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TYPE_STYLES[t]}`}>
      {TYPE_LABELS[t]}
    </span>
  );
}

export function ClientRolePill() {
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
      client
    </span>
  );
}
