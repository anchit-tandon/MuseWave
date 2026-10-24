import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{4}$/.test(pin)) {
      setError('Type your 4-digit PIN, numbers only.');
      return;
    }
    setIsLoading(true);
    const result = await login(pin);
    setIsLoading(false);
    if (result.ok) {
      navigate('/', { replace: true });
    } else {
      setError(result.error || 'That did not work. Please try again.');
      setPin('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-gray-900/80 backdrop-blur-lg rounded-2xl shadow-2xl border border-purple-500/20 p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              MuseWave
            </h1>
            <p className="text-gray-400 text-sm">Enter your 4-digit PIN to sign in</p>
          </div>

          {/* PIN form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <label htmlFor="pin" className="text-sm font-medium text-gray-200 block">
                PIN
              </label>
              <Input
                id="pin"
                name="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                autoComplete="current-password"
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="4 digits"
                required
                disabled={isLoading}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'pin-error' : undefined}
                className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500 text-center tracking-[0.5em] text-lg"
              />
            </div>

            {error && (
              <div
                id="pin-error"
                role="alert"
                className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading || pin.length !== 4}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Checking...' : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
