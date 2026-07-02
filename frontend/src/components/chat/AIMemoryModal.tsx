import React, { useState } from 'react';
import { Sparkles, Search, X, MessageSquare, ArrowRight, Calendar, FileText, Image as ImageIcon, Volume2 } from 'lucide-react';
import api from '../../api';
import { Message } from '../../store/store';

interface AIMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string | null;
  onJumpToMessage?: (messageId: string) => void;
}

export const AIMemoryModal: React.FC<AIMemoryModalProps> = ({
  isOpen,
  onClose,
  conversationId,
  onJumpToMessage
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [results, setResults] = useState<Message[]>([]);

  if (!isOpen) return null;

  const handleSearch = async (customQuery?: string) => {
    const q = customQuery || query;
    if (!q.trim()) return;

    setLoading(true);
    setAnswer(null);
    setResults([]);

    try {
      const res = await api.post('/ai/memory', {
        query: q,
        conversationId: conversationId || undefined
      });
      setAnswer(res.data.answer);
      setResults(res.data.messages || []);
    } catch (err) {
      console.error('AI memory query error:', err);
      setAnswer('⚠️ Failed to connect to AI Memory service. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    'When did they send a PDF or file?',
    'Show all travel & trip discussions',
    'What promises or agreements did we make?',
    'Find all photos and images'
  ];

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'image': return <ImageIcon className="w-4 h-4 text-teal-400" />;
      case 'audio': return <Volume2 className="w-4 h-4 text-amber-400" />;
      case 'file': return <FileText className="w-4 h-4 text-blue-400" />;
      default: return <MessageSquare className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border border-teal-500/30 rounded-2xl shadow-[0_0_50px_rgba(20,184,166,0.15)] overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-gradient-to-r from-teal-950/40 via-slate-900 to-slate-900">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Sparkles className="w-5 h-5 text-slate-950 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                AI Memory Assistant <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">Unique</span>
              </h2>
              <p className="text-xs text-zinc-400">
                Ask natural language questions to recall facts, promises, and files from your chat history
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

        {/* Search Input Area */}
        <div className="p-5 border-b border-slate-800/60 bg-slate-900/50">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="relative flex items-center"
          >
            <Search className="absolute left-3.5 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='e.g., "When did Rahul send the project PDF?" or "What travel plans did we discuss?"'
              className="w-full pl-11 pr-24 py-3 bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all text-sm"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="absolute right-2 px-4 py-1.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 disabled:opacity-50 text-slate-950 font-semibold text-xs rounded-lg transition-all shadow-md shadow-teal-500/20 flex items-center gap-1.5"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Recall</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Suggestion Chips */}
          <div className="flex flex-wrap gap-2 mt-3">
            {quickPrompts.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setQuery(prompt);
                  handleSearch(prompt);
                }}
                className="text-xs px-3 py-1.5 bg-slate-800/80 hover:bg-teal-500/20 text-zinc-300 hover:text-teal-300 border border-slate-700/60 hover:border-teal-500/40 rounded-lg transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-3 h-3 text-teal-400" />
                <span>{prompt}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-zinc-400 animate-pulse">Scanning conversation memory & synthesizing insights...</p>
            </div>
          )}

          {!loading && answer && (
            <div className="p-4 bg-gradient-to-r from-teal-950/60 to-slate-900 border border-teal-500/40 rounded-xl shadow-lg shadow-teal-500/5 space-y-2">
              <div className="flex items-center gap-2 text-teal-300 font-semibold text-sm">
                <Sparkles className="w-4 h-4" />
                <span>AI Memory Answer</span>
              </div>
              <p className="text-sm text-zinc-200 leading-relaxed">{answer}</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-1">
                Matched Conversations ({results.length})
              </h3>
              <div className="space-y-2">
                {results.map((msg: any) => (
                  <div
                    key={msg.id}
                    onClick={() => {
                      if (onJumpToMessage) {
                        onJumpToMessage(msg.id);
                        onClose();
                      }
                    }}
                    className="p-3.5 bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-teal-500/30 rounded-xl transition-all cursor-pointer group flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start space-x-3 min-w-0">
                      <div className="mt-0.5 p-2 bg-slate-950 rounded-lg border border-slate-800 group-hover:border-teal-500/30 transition-colors">
                        {getMessageIcon(msg.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-teal-400 truncate">
                            {msg.sender_name || 'User'}
                          </span>
                          <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(msg.created_at).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-300 mt-1 line-clamp-2 group-hover:text-white transition-colors">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 self-center bg-teal-500/10 px-2 py-1 rounded-md border border-teal-500/20">
                      <span>Jump</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && !answer && !results.length && (
            <div className="text-center py-12 text-zinc-500">
              <Sparkles className="w-12 h-12 text-zinc-700 mx-auto mb-3 stroke-1" />
              <p className="text-sm">Type a question above to explore your relationship history & memories!</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-900 text-center">
          <span className="text-[11px] text-zinc-500 flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3 text-teal-500 animate-pulse" /> CharChat Neural Memory Engine v2.0
          </span>
        </div>
      </div>
    </div>
  );
};
