import React, { useState } from 'react';
import { Clock, Lock, Calendar, Sparkles, X, Send, ShieldAlert, Zap } from 'lucide-react';

interface TimeCapsuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendCapsule: (content: string, unlockAt: number) => void;
}

export const TimeCapsuleModal: React.FC<TimeCapsuleModalProps> = ({
  isOpen,
  onClose,
  onSendCapsule
}) => {
  const [content, setContent] = useState('');
  const [preset, setPreset] = useState<'5min' | 'tomorrow' | 'nextweek' | 'custom'>('tomorrow');
  const [customDate, setCustomDate] = useState('');

  if (!isOpen) return null;

  const calculateUnlockTime = (): number => {
    const now = Date.now();
    switch (preset) {
      case '5min':
        return now + 5 * 60 * 1000;
      case 'tomorrow':
        return now + 24 * 60 * 60 * 1000;
      case 'nextweek':
        return now + 7 * 24 * 60 * 60 * 1000;
      case 'custom':
        return customDate ? new Date(customDate).getTime() : now + 3600000;
      default:
        return now + 86400000;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    const unlockAt = calculateUnlockTime();
    onSendCapsule(content, unlockAt);
    setContent('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-purple-500/30 rounded-2xl shadow-[0_0_50px_rgba(168,85,247,0.15)] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Clock className="w-5 h-5 text-white animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Time Capsule Message <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">Locked</span>
              </h2>
              <p className="text-xs text-zinc-400">
                Send a message that stays encrypted and locked until a future date
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          
          {/* Preset Buttons */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
              Choose Unlock Time
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setPreset('5min')}
                className={`p-2.5 rounded-xl border text-xs font-medium transition-all flex flex-col items-center gap-1 ${
                  preset === '5min'
                    ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-md shadow-purple-500/10'
                    : 'bg-slate-950/80 border-slate-800 text-zinc-400 hover:text-zinc-200 hover:bg-slate-800'
                }`}
              >
                <Zap className="w-4 h-4 text-amber-400" />
                <span>5 Mins (Demo)</span>
              </button>
              <button
                type="button"
                onClick={() => setPreset('tomorrow')}
                className={`p-2.5 rounded-xl border text-xs font-medium transition-all flex flex-col items-center gap-1 ${
                  preset === 'tomorrow'
                    ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-md shadow-purple-500/10'
                    : 'bg-slate-950/80 border-slate-800 text-zinc-400 hover:text-zinc-200 hover:bg-slate-800'
                }`}
              >
                <Clock className="w-4 h-4 text-purple-400" />
                <span>Tomorrow</span>
              </button>
              <button
                type="button"
                onClick={() => setPreset('nextweek')}
                className={`p-2.5 rounded-xl border text-xs font-medium transition-all flex flex-col items-center gap-1 ${
                  preset === 'nextweek'
                    ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-md shadow-purple-500/10'
                    : 'bg-slate-950/80 border-slate-800 text-zinc-400 hover:text-zinc-200 hover:bg-slate-800'
                }`}
              >
                <Calendar className="w-4 h-4 text-pink-400" />
                <span>Next Week</span>
              </button>
              <button
                type="button"
                onClick={() => setPreset('custom')}
                className={`p-2.5 rounded-xl border text-xs font-medium transition-all flex flex-col items-center gap-1 ${
                  preset === 'custom'
                    ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-md shadow-purple-500/10'
                    : 'bg-slate-950/80 border-slate-800 text-zinc-400 hover:text-zinc-200 hover:bg-slate-800'
                }`}
              >
                <Sparkles className="w-4 h-4 text-teal-400" />
                <span>Custom Date</span>
              </button>
            </div>
          </div>

          {preset === 'custom' && (
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 block">Select Exact Future Date & Time</label>
              <input
                type="datetime-local"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
          )}

          {/* Message textarea */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
              <span>Secret Capsule Message</span>
              <span className="text-[10px] text-purple-400 flex items-center gap-1 font-normal">
                <Lock className="w-3 h-3" /> End-to-End Time Locked
              </span>
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write a message for tomorrow, next year, birthday, or graduation! They won't be able to open it until the timer expires..."
              className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none"
            />
          </div>

          {/* Info banner */}
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-start gap-2.5 text-xs text-purple-200">
            <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <span>
              The message will appear in the chat as a **sealed vault**. Once the countdown hits zero, it automatically unlocks for both of you!
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!content.trim()}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-500/25 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Lock & Send Capsule</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
