import { initials } from '../lib/format';

export default function Avatar({ name, color, px = 32 }: { name: string; color?: string | null; px?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none"
      style={{ width: px, height: px, background: color || '#64748B', fontSize: Math.max(10, px * 0.38) }}
      title={name}
    >
      {initials(name)}
    </div>
  );
}
