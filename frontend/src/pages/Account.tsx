import { FormEvent, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import Avatar from '../components/Avatar';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          required
          autoComplete={autoComplete}
          className="input pr-10"
          placeholder="••••••••"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
          aria-label={show ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

export default function Account() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (!user) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setDone(false);
    if (next.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (next !== confirm) {
      setError('New password and confirmation do not match');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/change-password', { current, password: next });
      setDone(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err: any) {
      setError(err.message || 'Could not change password');
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = user.role === 'super' ? 'Administrator' : user.role === 'team' ? 'Team member' : 'Client';

  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="mb-1 text-xl font-semibold tracking-tight">Account</h1>
      <p className="mb-6 text-sm text-gray-500">Your sign-in details.</p>

      <div className="card mb-6 flex items-center gap-3 p-4">
        <Avatar name={user.name} color={user.avatar_color} px={44} />
        <div className="min-w-0">
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate text-sm text-gray-500">{user.email}</p>
          <p className="text-xs text-gray-400">{roleLabel}</p>
        </div>
      </div>

      <form onSubmit={submit} className="card space-y-3.5 p-5">
        <h2 className="text-base font-semibold">Change password</h2>
        <PasswordField id="current" label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
        <PasswordField id="new" label="New password" value={next} onChange={setNext} autoComplete="new-password" />
        <PasswordField id="confirm" label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {done && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Password updated. Use it next time you sign in.
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}
