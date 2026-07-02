import React, { useState } from 'react';
import { Gift, HelpCircle, X, Sparkles, Wand2, KeyRound } from 'lucide-react';

interface InteractiveGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendGame: (content: string, type: 'scratch_card' | 'truth_dare' | 'secret_vault', data: any) => void;
}

export const InteractiveGameModal: React.FC<InteractiveGameModalProps> = ({
  isOpen,
  onClose,
  onSendGame
}) => {
  const [gameType, setGameType] = useState<'scratch_card' | 'truth_dare' | 'secret_vault'>('scratch_card');
  const [secretText, setSecretText] = useState('');
  const [vaultQuestion, setVaultQuestion] = useState('');
  const [vaultAnswer, setVaultAnswer] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretText.trim() && gameType !== 'truth_dare') return;

    if (gameType === 'scratch_card') {
      onSendGame(`🎟️ Scratch Card Surprise: ${secretText}`, 'scratch_card', {
        secret: secretText,
        revealed: false
      });
    } else if (gameType === 'truth_dare') {
      const options = ['Truth: What is your biggest secret?', 'Dare: Send a voice note singing your favorite song!', 'Truth: What was your first impression of me?', 'Dare: Send a funny selfie right now!'];
      const chosen = options[Math.floor(Math.random() * options.length)];
      onSendGame(`🎰 Spin Wheel Challenge: ${chosen}`, 'truth_dare', {
        challenge: chosen
      });
    } else if (gameType === 'secret_vault') {
      if (!vaultQuestion.trim() || !vaultAnswer.trim()) return;
      onSendGame(`🔐 Secret Password Vault: "${vaultQuestion}"`, 'secret_vault', {
        question: vaultQuestion,
        answer: vaultAnswer.toLowerCase().trim(),
        secret: secretText
      });
    }

    setSecretText('');
    setVaultQuestion('');
    setVaultAnswer('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-pink-500/30 rounded-2xl shadow-[0_0_50px_rgba(236,72,153,0.15)] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-gradient-to-r from-pink-950/40 via-slate-900 to-slate-900">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Gift className="w-5 h-5 text-white animate-bounce" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Interactive Surprise <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">Game</span>
              </h2>
              <p className="text-xs text-zinc-400">
                Send a fun scratch card, spin wheel challenge, or password vault!
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
          
          {/* Game Type Selection */}
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setGameType('scratch_card')}
              className={`p-3 rounded-xl border text-xs font-semibold transition-all flex flex-col items-center gap-1.5 ${
                gameType === 'scratch_card'
                  ? 'bg-pink-500/20 border-pink-500 text-pink-300 shadow-md shadow-pink-500/10'
                  : 'bg-slate-950/80 border-slate-800 text-zinc-400 hover:text-zinc-200 hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-5 h-5 text-pink-400" />
              <span>🎟️ Scratch Card</span>
            </button>
            <button
              type="button"
              onClick={() => setGameType('truth_dare')}
              className={`p-3 rounded-xl border text-xs font-semibold transition-all flex flex-col items-center gap-1.5 ${
                gameType === 'truth_dare'
                  ? 'bg-pink-500/20 border-pink-500 text-pink-300 shadow-md shadow-pink-500/10'
                  : 'bg-slate-950/80 border-slate-800 text-zinc-400 hover:text-zinc-200 hover:bg-slate-800'
              }`}
            >
              <Wand2 className="w-5 h-5 text-amber-400" />
              <span>🎰 Spin Wheel</span>
            </button>
            <button
              type="button"
              onClick={() => setGameType('secret_vault')}
              className={`p-3 rounded-xl border text-xs font-semibold transition-all flex flex-col items-center gap-1.5 ${
                gameType === 'secret_vault'
                  ? 'bg-pink-500/20 border-pink-500 text-pink-300 shadow-md shadow-pink-500/10'
                  : 'bg-slate-950/80 border-slate-800 text-zinc-400 hover:text-zinc-200 hover:bg-slate-800'
              }`}
            >
              <KeyRound className="w-5 h-5 text-teal-400" />
              <span>🔐 Secret Vault</span>
            </button>
          </div>

          {/* Form Fields for Scratch Card */}
          {gameType === 'scratch_card' && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
                Hidden Scratch Card Message
              </label>
              <textarea
                rows={3}
                value={secretText}
                onChange={(e) => setSecretText(e.target.value)}
                placeholder='e.g., "You won a free movie night tonight! 🍿" or a secret love note...'
                className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-pink-500 transition-all resize-none"
              />
            </div>
          )}

          {/* Form Fields for Truth or Dare */}
          {gameType === 'truth_dare' && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-center">
              <Wand2 className="w-8 h-8 text-amber-400 mx-auto animate-pulse" />
              <h3 className="text-sm font-bold text-white">Truth or Dare Mystery Spinner</h3>
              <p className="text-xs text-zinc-400">
                When you click Send, AI will generate a random fun Truth or Dare challenge for both of you to complete!
              </p>
            </div>
          )}

          {/* Form Fields for Secret Vault */}
          {gameType === 'secret_vault' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300 block">Security Question / Riddle</label>
                <input
                  type="text"
                  value={vaultQuestion}
                  onChange={(e) => setVaultQuestion(e.target.value)}
                  placeholder='e.g., "Where did we first meet?" or "What is our dog’s name?"'
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-pink-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300 block">Required Answer (Password)</label>
                <input
                  type="text"
                  value={vaultAnswer}
                  onChange={(e) => setVaultAnswer(e.target.value)}
                  placeholder='e.g., "starbucks" or "max"'
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-pink-500 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300 block">Secret Message Inside Vault</label>
                <textarea
                  rows={2}
                  value={secretText}
                  onChange={(e) => setSecretText(e.target.value)}
                  placeholder="The secret text that will be revealed once they type the correct answer..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-pink-500 resize-none"
                />
              </div>
            </div>
          )}

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
              disabled={gameType !== 'truth_dare' && !secretText.trim()}
              className="px-6 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-pink-500/25 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Gift className="w-4 h-4" />
              <span>Send Surprise</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
