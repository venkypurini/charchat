import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useChatStore } from '../../store/store';
import api from '../../api';
import { MessageSquare, Lock, User, AlertCircle, Loader2 } from 'lucide-react';

export default function Signup() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const token = useChatStore((state) => state.token);
  const setUser = useChatStore((state) => state.setUser);
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      navigate('/');
    }
  }, [token, navigate]);

  // Generate dynamic preview URL using DiceBear
  const avatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(username || 'placeholder')}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/register', { 
        username, 
        password,
        avatar_url: avatarUrl 
      });
      setUser(response.data.user, response.data.token);
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-chitchatGray relative overflow-hidden px-4">
      {/* WhatsApp Web Style Top Banner */}
      <div className="absolute top-0 left-0 w-full h-[220px] bg-chitchatTeal z-0"></div>

      {/* App Branding */}
      <div className="relative z-10 flex items-center gap-3.5 mb-4 mt-6">
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md">
          <MessageSquare className="w-5 h-5 text-chitchatTeal" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-wide">CHITCHAT</h1>
      </div>

      {/* Signup Card */}
      <div className="w-full max-w-md bg-white rounded-lg p-6 shadow-xl relative z-10 border border-gray-200 mb-6">
        <div className="flex flex-col mb-4">
          <h2 className="text-xl font-bold text-chitchatTextDark">Create Account</h2>
          <p className="text-chitchatTextLight text-xs mt-1">Register to start messaging in real-time</p>
        </div>

        {/* Dynamic Avatar Preview */}
        <div className="flex flex-col items-center mb-4 bg-gray-50 py-3 rounded-lg border border-dashed border-gray-200">
          <div className="w-16 h-16 rounded-full border-2 border-chitchatTeal p-0.5 bg-white overflow-hidden shadow-inner flex items-center justify-center">
            <img 
              src={avatarUrl} 
              alt="Avatar Preview" 
              className="w-full h-full rounded-full object-cover bg-gray-100"
            />
          </div>
          <span className="text-[9px] font-bold text-chitchatTextLight mt-1.5 uppercase tracking-widest">Live Avatar Preview</span>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-red-700 text-xs font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-chitchatTextLight uppercase tracking-wider">Username</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-chitchatTextLight" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))}
                placeholder="Choose a username"
                className="w-full pl-10 pr-4 py-2 rounded-md border border-gray-200 bg-white text-chitchatTextDark outline-none text-sm focus:border-chitchatTeal focus:ring-1 focus:ring-chitchatTeal transition-all"
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-chitchatTextLight uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-chitchatTextLight" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create password"
                className="w-full pl-10 pr-4 py-2 rounded-md border border-gray-200 bg-white text-chitchatTextDark outline-none text-sm focus:border-chitchatTeal focus:ring-1 focus:ring-chitchatTeal transition-all"
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-chitchatTextLight uppercase tracking-wider">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-chitchatTextLight" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full pl-10 pr-4 py-2 rounded-md border border-gray-200 bg-white text-chitchatTextDark outline-none text-sm focus:border-chitchatTeal focus:ring-1 focus:ring-chitchatTeal transition-all"
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-md bg-chitchatTeal hover:bg-chitchatDarkTeal text-white font-bold text-sm tracking-wider transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                REGISTERING...
              </>
            ) : (
              'SIGN UP'
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-chitchatTextLight">
          Already have an account?{' '}
          <Link to="/login" className="text-chitchatTeal hover:underline font-bold">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
