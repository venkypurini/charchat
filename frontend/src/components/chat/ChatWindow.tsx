import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { useChatStore } from '../../store/store';
import { useChat } from '../../hooks/useChat';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { ChevronLeft, MessageSquare, Info, Phone, Video, MoreVertical, PhoneOff, Sparkles, History, BellDot, Trash2 } from 'lucide-react';
import api from '../../api';
import { AIMemoryModal } from './AIMemoryModal';
import { ConversationTimeline } from './ConversationTimeline';

export default function ChatWindow() {
  const { user, conversations, activeConversationId, messages, typingUsers, onlineUsers, setActiveConversationId, addCall, smartSilentMode, setSmartSilentMode } = useChatStore();
  const { sendMessage, sendTypingStart, sendTypingStop, sendReadReceipt, loadMessages } = useChat();

  const [isCalling, setIsCalling] = useState(false);
  const [callType, setCallType] = useState<'voice' | 'video'>('voice');
  const [showAIMemory, setShowAIMemory] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [jumpMessageId, setJumpMessageId] = useState<string | null>(null);

  const activeConversation = useMemo(() => {
    return conversations.find(c => c.id === activeConversationId) || null;
  }, [conversations, activeConversationId]);

  const peer = useMemo(() => {
    if (!activeConversation || activeConversation.is_group) return null;
    return activeConversation.members.find(m => m.id !== user?.id) || activeConversation.members[0] || null;
  }, [activeConversation, user]);

  const handleInitiateCall = async (type: 'voice' | 'video') => {
    if (!peer) return;
    setCallType(type);
    setIsCalling(true);
    
    try {
      const response = await api.post('/calls', {
        receiver_id: peer.id,
        type
      });
      addCall(response.data);
    } catch (err) {
      console.error('Failed to log call:', err);
    }
  };

  // Load message history when active conversation changes
  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId).catch(console.error);
      sendReadReceipt(activeConversationId);
    }
  }, [activeConversationId]);

  const activeMessages = useMemo(() => {
    if (!activeConversationId) return [];
    return messages[activeConversationId] || [];
  }, [messages, activeConversationId]);

  const handleSend = useCallback((content: string, type: string = 'text', extra?: any) => {
    if (activeConversationId) {
      sendMessage(activeConversationId, content, type, extra);
    }
  }, [activeConversationId, sendMessage]);

  const handleTypingStart = useCallback(() => {
    if (activeConversationId) {
      sendTypingStart(activeConversationId);
    }
  }, [activeConversationId, sendTypingStart]);

  const handleTypingStop = useCallback(() => {
    if (activeConversationId) {
      sendTypingStop(activeConversationId);
    }
  }, [activeConversationId, sendTypingStop]);

  const handleLoadMore = useCallback(async () => {
    if (!activeConversationId || activeMessages.length === 0) return [];
    const firstMsgTimestamp = activeMessages[0].created_at;
    return await loadMessages(activeConversationId, firstMsgTimestamp);
  }, [activeConversationId, activeMessages.length, loadMessages]);

  // Resolve chat name, avatar, and online status
  const conversationDetails = useMemo(() => {
    if (!activeConversation) return null;

    if (activeConversation.is_group) {
      return {
        title: activeConversation.name || 'Group Chat',
        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(activeConversation.id)}`,
        subtitle: `${activeConversation.members.length} members`
      };
    }

    const peer = activeConversation.members.find(m => m.id !== user?.id) || activeConversation.members[0];
    if (!peer) {
      return { title: 'Saved Messages', avatar: user?.avatar_url || '', subtitle: 'Personal space' };
    }

    const isPeerOnline = onlineUsers.includes(peer.id) || peer.status === 'online';

    return {
      title: peer.username,
      avatar: peer.avatar_url,
      subtitle: isPeerOnline ? 'Online' : 'Offline'
    };
  }, [activeConversation, user, onlineUsers]);

  // Typing status text
  const typersText = useMemo(() => {
    if (!activeConversationId) return '';
    const typers = typingUsers[activeConversationId] || [];
    if (typers.length === 0) return '';
    if (typers.length === 1) return `${typers[0].username} is typing...`;
    return `${typers.slice(0, 2).map(t => t.username).join(', ')} are typing...`;
  }, [typingUsers, activeConversationId]);

  if (!activeConversationId || !activeConversation || !conversationDetails) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-400 p-8">
        <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-5 text-slate-400 shadow-[0_0_20px_rgba(20,184,166,0.15)]">
          <MessageSquare className="w-10 h-10 text-teal-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-100">CharChat Web</h3>
        <p className="text-xs text-slate-400 mt-2 max-w-xs text-center leading-relaxed">
          Send and receive messages in real-time. Pick a conversation or start a group to begin chatting!
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0f19] chitchat-bg-pattern overflow-hidden relative">
      
      {/* Header */}
      <div className="p-3.5 bg-slate-900/90 border-b border-slate-800/80 backdrop-blur-md text-white flex items-center justify-between shrink-0 shadow-md z-10">
        <div className="flex items-center gap-3.5 min-w-0">
          {/* Back button (Mobile & Tablet) */}
          <button 
            onClick={() => setActiveConversationId(null)}
            className="lg:hidden p-1.5 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer -ml-1 mr-1"
            title="Back to Chats"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <img 
            src={conversationDetails.avatar} 
            alt={conversationDetails.title} 
            className="w-10 h-10 rounded-full bg-white/10 border border-slate-700" 
          />
          
          <div className="min-w-0">
            <h3 className="font-bold text-slate-100 text-sm leading-tight truncate">{conversationDetails.title}</h3>
            {typersText ? (
              <span className="text-[10px] text-teal-400 font-bold pulse-active">{typersText}</span>
            ) : (
              <span className="text-[10px] text-slate-400">
                {conversationDetails.subtitle}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-slate-300">
          {/* AI Memory Assistant Button */}
          <button
            onClick={() => setShowAIMemory(true)}
            title="AI Memory Assistant (Search History & Facts)"
            className="p-1.5 rounded-lg bg-gradient-to-tr from-teal-500/20 to-emerald-500/10 border border-teal-500/30 hover:bg-teal-500/30 text-teal-300 transition-all flex items-center gap-1 shadow-sm"
          >
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span className="hidden sm:inline text-xs font-semibold">AI Memory</span>
          </button>

          {/* Relationship Timeline Toggle Button */}
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            title="Toggle Relationship Milestone Timeline"
            className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 ${
              showTimeline 
                ? 'bg-purple-500/30 border-purple-400 text-purple-200 shadow-lg shadow-purple-500/20' 
                : 'bg-slate-800/80 border-slate-700 hover:bg-slate-800 text-zinc-300 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-medium">Timeline</span>
          </button>

          {/* Smart Silent Mode Toggle */}
          <button
            onClick={() => setSmartSilentMode(!smartSilentMode)}
            title={`Smart Silent Mode (AI Priority Routing): ${smartSilentMode ? 'ON' : 'OFF'}`}
            className={`p-1.5 rounded-lg border transition-all ${
              smartSilentMode
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-sm'
                : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <BellDot className="w-4 h-4" />
          </button>

          <div className="h-5 w-px bg-slate-800 mx-0.5" />

          {peer ? (
            <>
              <button 
                onClick={() => handleInitiateCall('video')}
                title="Start Video Call"
                className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                <Video className="w-5 h-5" />
              </button>
              <button 
                onClick={() => handleInitiateCall('voice')}
                title="Start Voice Call"
                className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                <Phone className="w-4.5 h-4.5" />
              </button>
            </>
          ) : (
            <>
              <button 
                disabled
                title="Group calling not supported"
                className="p-1.5 rounded text-slate-600 cursor-not-allowed"
              >
                <Video className="w-5 h-5" />
              </button>
              <button 
                disabled
                title="Group calling not supported"
                className="p-1.5 rounded text-slate-600 cursor-not-allowed"
              >
                <Phone className="w-4.5 h-4.5" />
              </button>
            </>
          )}
          <button 
            onClick={async () => {
              if (window.confirm("Remove this conversation from your active chats list? (The contact remains safe in your Saved Contacts book).")) {
                try {
                  if (activeConversationId) {
                    await api.delete(`/conversations/${activeConversationId}`);
                    useChatStore.getState().deleteConversation(activeConversationId);
                    setActiveConversationId(null);
                  }
                } catch (err) {
                  console.error("Failed to delete active chat:", err);
                }
              }
            }}
            title="Remove Active Chat"
            className="p-1.5 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-all cursor-pointer"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Timeline view or Normal Chat view */}
      {showTimeline ? (
        <ConversationTimeline
          messages={activeMessages}
          conversationName={conversationDetails.title}
          onClose={() => setShowTimeline(false)}
          onJumpToMessage={(id) => {
            setShowTimeline(false);
            setJumpMessageId(id);
          }}
        />
      ) : (
        <>
          {/* Message List Area */}
          <MessageList 
            conversationId={activeConversationId} 
            messages={activeMessages} 
            conversation={activeConversation}
            onLoadMore={handleLoadMore}
            jumpMessageId={jumpMessageId}
            onClearJump={() => setJumpMessageId(null)}
          />

          {/* Message Input */}
          <MessageInput 
            onSend={handleSend} 
            onTypingStart={handleTypingStart} 
            onTypingStop={handleTypingStop} 
          />
        </>
      )}

      {/* AI Memory Modal */}
      <AIMemoryModal
        isOpen={showAIMemory}
        onClose={() => setShowAIMemory(false)}
        conversationId={activeConversationId}
        onJumpToMessage={(id) => {
          setShowTimeline(false);
          setJumpMessageId(id);
        }}
      />

      {/* Ringing Overlay */}
      {isCalling && (
        <div className="absolute inset-0 bg-slate-950/95 border border-slate-800/80 backdrop-blur-md z-30 flex flex-col justify-between p-8 text-white select-none">
          {/* Header info */}
          <div className="flex flex-col items-center mt-12 space-y-2">
            <span className="text-xs uppercase tracking-widest text-slate-400 font-bold">CharChat Secure Call</span>
            <h2 className="text-2xl font-bold mt-2 text-slate-100">{conversationDetails.title}</h2>
            <span className="text-sm text-teal-400 font-medium animate-pulse">{callType === 'video' ? 'Video Calling...' : 'Calling...'}</span>
          </div>

          {/* Central Avatar with pulse animations */}
          <div className="flex items-center justify-center my-auto">
            <div className="relative flex items-center justify-center w-36 h-36">
              <div className="absolute inset-0 rounded-full bg-teal-500/10 animate-ping opacity-75"></div>
              <div className="absolute -inset-4 rounded-full bg-teal-500/5 animate-pulse opacity-50 scale-110"></div>
              <img 
                src={conversationDetails.avatar} 
                alt={conversationDetails.title} 
                className="w-28 h-28 rounded-full border-4 border-teal-500/30 relative z-10 shadow-2xl bg-slate-900" 
              />
            </div>
          </div>

          {/* Bottom actions */}
          <div className="flex flex-col items-center mb-12 space-y-4">
            <button 
              onClick={() => setIsCalling(false)}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 transition-all flex items-center justify-center text-white shadow-xl cursor-pointer hover:rotate-12 duration-200 shadow-red-900/40"
              title="Hang Up"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
            <span className="text-xs text-slate-400">End Call</span>
          </div>
        </div>
      )}
    </div>
  );
}
