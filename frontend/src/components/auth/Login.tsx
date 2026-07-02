import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../../store/store';
import api from '../../api';
import { MessageSquare, Lock, User, Phone, AlertCircle, Loader2, KeyRound, Check } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<1 | 2>(1); // Step 1: Username/Mobile, Step 2: Enter OTP
  
  const [mockOtp, setMockOtp] = useState<string | null>(null);
  const [smsSent, setSmsSent] = useState<boolean>(false);
  const [smsProvider, setSmsProvider] = useState<string>('Mock SMS Gateway');
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

  const handleGetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !mobile.trim()) {
      setError('Please enter both username and mobile number');
      return;
    }

    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(mobile)) {
      setError('Mobile number must be exactly 10 digits');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/send-otp', { username, mobile });
      if (response.data.success) {
        setMockOtp(response.data.otp);
        setSmsSent(response.data.smsSent || false);
        setSmsProvider(response.data.smsProvider || 'Mock SMS Gateway');
        setStep(2);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to request OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/verify-otp', { username, mobile, otp });
      setUser(response.data.user, response.data.token);
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-950 relative overflow-hidden px-4">
      {/* 3D Glowing Ambient Backdrops */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl z-0"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl z-0"></div>

      {/* SMS Gateway Alert Toast */}
      {step === 2 && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
          <div className={`bg-slate-900/90 text-white rounded-xl p-4 shadow-2xl border ${smsSent ? 'border-green-500/40' : 'border-teal-500/40'} flex items-start gap-3.5 backdrop-blur-md animate-bounce`}>
            <MessageSquare className={`w-5 h-5 ${smsSent ? 'text-green-400' : 'text-teal-400'} shrink-0 mt-0.5`} />
            <div>
              <h4 className={`font-bold text-xs ${smsSent ? 'text-green-400' : 'text-teal-400'} tracking-wider`}>
                {smsSent ? (smsProvider.includes('WhatsApp') ? `💬 REAL WHATSAPP SENT (${smsProvider})` : `📲 REAL SMS SENT (${smsProvider})`) : 'MOCK SMS GATEWAY'}
              </h4>
              <p className="text-[11px] text-gray-300 mt-1 leading-normal">
                {smsSent 
                  ? (smsProvider.includes('WhatsApp') ? `A WhatsApp message code was sent to ${mobile}.` : `An actual text message code was sent to ${mobile}.`)
                  : 'Your CharChat verification code is:'}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                {mockOtp && (
                  <span className="text-white text-base font-extrabold tracking-widest bg-teal-500/20 px-2.5 py-1 rounded font-mono border border-teal-500/30">
                    {mockOtp}
                  </span>
                )}
                <span className={`text-[10px] ${smsSent ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-teal-400 bg-teal-500/10 border-teal-500/20'} font-bold border py-0.5 px-1.5 rounded uppercase`}>
                  {smsSent ? 'Live SMS' : 'Code Sent'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* App Branding */}
      <div className="relative z-10 flex items-center gap-3.5 mb-6">
        <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center shadow-md">
          <MessageSquare className="w-5 h-5 text-teal-400" />
        </div>
        <h1 className="text-xl font-extrabold text-white tracking-wide">CHARCHAT</h1>
      </div>

      {/* Unified Login Portal Card */}
      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl rounded-2xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] relative z-10 border border-slate-800/80">
        <div className="flex flex-col mb-6">
          <h2 className="text-xl font-bold text-white">OTP Verification Login</h2>
          <p className="text-zinc-400 text-xs mt-1">
            {step === 1 
              ? 'Enter your details to receive a 6-digit mock SMS verification code.' 
              : `A verification code was sent to your mobile number ending in ...${mobile.slice(-4)}`
            }
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-md bg-red-950/30 border border-red-900/50 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-400 text-xs font-medium">{error}</p>
          </div>
        )}

        {step === 1 ? (
          /* Step 1: Send OTP Form */
          <form onSubmit={handleGetOtp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-teal-400 uppercase tracking-wider">Username</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-450" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))}
                  placeholder="Create or enter username"
                  className="w-full pl-10 pr-4 py-2.5 rounded-md border border-slate-800 bg-slate-950/80 text-white outline-none text-sm placeholder-zinc-500 focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-all"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-teal-400 uppercase tracking-wider">Mobile Number (10 digits)</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-450" />
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="e.g. 9876543210"
                  className="w-full pl-10 pr-4 py-2.5 rounded-md border border-slate-800 bg-slate-950/80 text-white outline-none text-sm placeholder-zinc-500 focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-all"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !username.trim() || mobile.length !== 10}
              className="w-full py-2.5 rounded-md bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-sm tracking-wider transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  REQUESTING CODE...
                </>
              ) : (
                'GET OTP'
              )}
            </button>
          </form>
        ) : (
          /* Step 2: Verify OTP Form */
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-teal-400 uppercase tracking-wider">Enter 6-Digit Code</label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-450" />
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter code"
                  className="w-full pl-10 pr-4 py-2.5 rounded-md border border-slate-800 bg-slate-950/80 text-white outline-none text-sm tracking-widest font-mono text-center font-bold focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-all"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full py-2.5 rounded-md bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-sm tracking-wider transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  VERIFYING...
                </>
              ) : (
                'VERIFY & ENTER'
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setMockOtp(null);
                setOtp('');
                setError('');
              }}
              className="w-full py-2 text-center text-xs text-teal-400 font-bold hover:underline"
              disabled={loading}
            >
              Change Mobile Number / Re-request OTP
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
