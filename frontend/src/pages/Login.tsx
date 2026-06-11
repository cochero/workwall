import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captcha, setCaptcha] = useState<{ token: string; question: string } | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadCaptcha = useCallback(async () => {
    setCaptchaAnswer('');
    try {
      const d = await api.get('/auth/captcha');
      setCaptcha({ token: d.token, question: d.question });
    } catch {
      setCaptcha(null);
    }
  }, []);

  useEffect(() => {
    loadCaptcha();
  }, [loadCaptcha]);

  if (!loading && user) return <Navigate to="/feed" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!captcha) {
      setError('Verification not loaded — tap refresh and try again');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password, { token: captcha.token, answer: captchaAnswer.trim() });
      navigate('/feed', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Login failed');
      loadCaptcha(); // rotate the captcha after any failed attempt
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-lg font-bold text-white">W</div>
          <div>
            <p className="text-lg font-semibold leading-tight tracking-tight">Workwall</p>
            <p className="text-xs text-gray-400">KlickEvents client &amp; team workspace</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3.5">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoFocus
              className="input"
              placeholder="you@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="password">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                className="input pr-10"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="captcha">Verification</label>
            <div className="flex items-center gap-2">
              <span className="flex h-9 select-none items-center rounded-lg border border-gray-200 bg-gray-50 px-3 font-mono text-sm font-semibold tracking-wider text-gray-700">
                {captcha ? `${captcha.question} =` : '· · ·'}
              </span>
              <input
                id="captcha"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                required
                className="input w-16 text-center"
                placeholder="?"
                value={captchaAnswer}
                onChange={e => setCaptchaAnswer(e.target.value)}
              />
              <button
                type="button"
                onClick={loadCaptcha}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                aria-label="Get a new verification question"
                tabIndex={-1}
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full !py-2.5">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-gray-400">
          One wall per project — updates, files and discussion in one place.
        </p>
      </div>
    </div>
  );
}
