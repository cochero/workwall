import { File, FileSpreadsheet, FileText, Image as ImageIcon, MessageSquare } from 'lucide-react';
import { StatusPill } from './Badges';
import { fmtSize } from '../lib/format';
import type { FileCategory, WFile } from '../lib/types';

export function CategoryIcon({ category, size = 18 }: { category: FileCategory; size?: number }) {
  switch (category) {
    case 'image':
      return <ImageIcon size={size} className="text-sky-500" />;
    case 'pdf':
      return <FileText size={size} className="text-red-500" />;
    case 'doc':
      return <FileText size={size} className="text-blue-500" />;
    case 'sheet':
      return <FileSpreadsheet size={size} className="text-emerald-600" />;
    default:
      return <File size={size} className="text-gray-400" />;
  }
}

export default function FileChip({ file, onOpen }: { file: WFile; onOpen: (id: number) => void }) {
  return (
    <button
      onClick={() => onOpen(file.id)}
      className="flex w-full items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:border-violet-300 hover:bg-violet-50/30"
    >
      <CategoryIcon category={file.category} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-gray-800">{file.original_name}</span>
        <span className="block text-[11px] text-gray-400">
          v{file.version_no} · {fmtSize(file.size_bytes)}
        </span>
      </span>
      <StatusPill s={file.status} />
      {(file.comment_count || 0) > 0 && (
        <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
          <MessageSquare size={12} /> {file.comment_count}
        </span>
      )}
    </button>
  );
}
