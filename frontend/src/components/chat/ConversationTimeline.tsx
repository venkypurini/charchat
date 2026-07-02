import React, { useMemo } from 'react';
import { Heart, Camera, Mic, FileText, Gift, Award, Calendar, ArrowLeft, MessageSquare, Sparkles } from 'lucide-react';
import { Message } from '../../store/store';

interface ConversationTimelineProps {
  messages: Message[];
  conversationName: string;
  onClose: () => void;
  onJumpToMessage: (messageId: string) => void;
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  date: number;
  icon: React.ReactNode;
  color: string;
  messageId: string;
  content: string;
}

export const ConversationTimeline: React.FC<ConversationTimelineProps> = ({
  messages,
  conversationName,
  onClose,
  onJumpToMessage
}) => {
  const milestones = useMemo(() => {
    if (!messages || messages.length === 0) return [];
    
    // Ensure chronological order (oldest first)
    const sorted = [...messages].sort((a, b) => a.created_at - b.created_at);
    const list: Milestone[] = [];

    // 1. First Message
    if (sorted.length > 0) {
      const first = sorted[0];
      list.push({
        id: 'first_msg',
        title: 'The Beginning ❤️',
        description: 'The very first message that started this journey',
        date: first.created_at,
        icon: <Heart className="w-5 h-5 text-rose-400 fill-rose-400/20" />,
        color: 'from-rose-500/20 to-pink-500/10 border-rose-500/40 text-rose-300',
        messageId: first.id,
        content: first.content
      });
    }

    // 2. First Photo
    const firstImg = sorted.find(m => m.type === 'image');
    if (firstImg) {
      list.push({
        id: 'first_img',
        title: 'First Snapshot 📷',
        description: 'The first visual shared between you two',
        date: firstImg.created_at,
        icon: <Camera className="w-5 h-5 text-teal-400" />,
        color: 'from-teal-500/20 to-emerald-500/10 border-teal-500/40 text-teal-300',
        messageId: firstImg.id,
        content: firstImg.content || 'Photo Attachment'
      });
    }

    // 3. First Voice Note
    const firstAudio = sorted.find(m => m.type === 'audio');
    if (firstAudio) {
      list.push({
        id: 'first_audio',
        title: 'First Voice Note 🎤',
        description: 'Hearing each other’s voice for the first time',
        date: firstAudio.created_at,
        icon: <Mic className="w-5 h-5 text-amber-400" />,
        color: 'from-amber-500/20 to-orange-500/10 border-amber-500/40 text-amber-300',
        messageId: firstAudio.id,
        content: 'Voice Message'
      });
    }

    // 4. First File
    const firstFile = sorted.find(m => m.type === 'file');
    if (firstFile) {
      list.push({
        id: 'first_file',
        title: 'First Document Shared 📂',
        description: 'Sharing files & important resources',
        date: firstFile.created_at,
        icon: <FileText className="w-5 h-5 text-blue-400" />,
        color: 'from-blue-500/20 to-indigo-500/10 border-blue-500/40 text-blue-300',
        messageId: firstFile.id,
        content: firstFile.content
      });
    }

    // 5. First Time Capsule or Interactive Game
    const firstGame = sorted.find(m => m.unlock_at || m.interactive_type);
    if (firstGame) {
      list.push({
        id: 'first_game',
        title: 'First Secret Surprise 🎁',
        description: 'An interactive scratch card, vault, or time capsule',
        date: firstGame.created_at,
        icon: <Gift className="w-5 h-5 text-purple-400" />,
        color: 'from-purple-500/20 to-violet-500/10 border-purple-500/40 text-purple-300',
        messageId: firstGame.id,
        content: firstGame.content || 'Interactive Message'
      });
    }

    // 6. Milestone Clubs (10th, 50th, 100th message)
    if (sorted.length >= 10) {
      const msg10 = sorted[9];
      list.push({
        id: 'msg_10',
        title: '10 Messages Milestone 🎉',
        description: 'Off to a great start!',
        date: msg10.created_at,
        icon: <Award className="w-5 h-5 text-yellow-400" />,
        color: 'from-yellow-500/20 to-amber-500/10 border-yellow-500/40 text-yellow-300',
        messageId: msg10.id,
        content: msg10.content
      });
    }

    if (sorted.length >= 50) {
      const msg50 = sorted[49];
      list.push({
        id: 'msg_50',
        title: '50 Messages Club 🚀',
        description: 'The conversation is heating up!',
        date: msg50.created_at,
        icon: <Award className="w-5 h-5 text-emerald-400" />,
        color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/40 text-emerald-300',
        messageId: msg50.id,
        content: msg50.content
      });
    }

    if (sorted.length >= 100) {
      const msg100 = sorted[99];
      list.push({
        id: 'msg_100',
        title: '100th Message Milestone 🏆',
        description: 'A true CharChat connection!',
        date: msg100.created_at,
        icon: <Award className="w-5 h-5 text-cyan-400" />,
        color: 'from-cyan-500/20 to-blue-500/10 border-cyan-500/40 text-cyan-300',
        messageId: msg100.id,
        content: msg100.content
      });
    }

    return list.sort((a, b) => a.date - b.date);
  }, [messages]);

  return (
    <div className="flex-1 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col h-full overflow-hidden animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-3">
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-1 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Chat</span>
          </button>
          <div className="h-6 w-px bg-slate-800" />
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-lg text-white shadow-md shadow-purple-500/20">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Relationship Timeline <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">Milestones</span>
              </h2>
              <p className="text-xs text-zinc-400">Celebrating special memories with {conversationName}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Body */}
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
        {milestones.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <MessageSquare className="w-12 h-12 text-zinc-700 mx-auto stroke-1" />
            <h3 className="text-base font-semibold text-zinc-400">No milestones yet</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Start chatting, sharing photos, voice notes, and surprises to unlock your interactive timeline!
            </p>
          </div>
        ) : (
          <div className="relative border-l-2 border-slate-800 ml-6 md:ml-20 py-4 space-y-10">
            {milestones.map((item) => (
              <div key={item.id} className="relative group pl-6 md:pl-8">
                
                {/* Timeline Node Icon */}
                <div className="absolute -left-[17px] top-1.5 w-8 h-8 rounded-full bg-slate-950 border-2 border-slate-700 group-hover:border-teal-500 flex items-center justify-center shadow-lg transition-colors">
                  {item.icon}
                </div>

                {/* Milestone Card */}
                <div
                  onClick={() => {
                    onJumpToMessage(item.messageId);
                    onClose();
                  }}
                  className={`p-5 bg-gradient-to-r ${item.color} bg-slate-900/80 border rounded-2xl shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all cursor-pointer space-y-2.5 backdrop-blur-sm`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                      {item.title}
                    </h3>
                    <span className="text-xs text-zinc-400 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800 flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3 text-teal-400" />
                      {new Date(item.date).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>

                  <p className="text-xs font-medium text-zinc-300">{item.description}</p>

                  <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800/80 text-sm text-zinc-200 font-serif italic line-clamp-2">
                    "{item.content}"
                  </div>

                  <div className="text-[11px] font-semibold text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1 pt-1">
                    <span>Jump to conversation moment</span>
                    <span>→</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-slate-950 border-t border-slate-900 text-center">
        <span className="text-[11px] text-zinc-500">
          CharChat Timeline Engine • Total Messages Exchanged: {messages.length}
        </span>
      </div>
    </div>
  );
};
