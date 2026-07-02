import React, { useEffect, useRef, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { useChatStore, Message, Conversation } from '../../store/store';
import { getSocket } from '../../hooks/useSocket';
import { Check, CheckCheck, Clock, Loader2, X, Download, FileText, Video as VideoIcon, Copy, Trash2, CheckCircle2, ShieldAlert } from 'lucide-react';

interface MessageListProps {
  conversationId: string;
  messages: Message[];
  conversation: Conversation;
  onLoadMore: () => Promise<any>;
}

export default React.memo(function MessageList({ conversationId, messages, conversation, onLoadMore }: MessageListProps) {
  const user = useChatStore((state) => state.user);
  const deleteMessage = useChatStore((state) => state.deleteMessage);
  const removeMessage = useChatStore((state) => state.removeMessage);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [viewingImage, setViewingImage] = useState<{ src: string; sender: string; time: number } | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);
  const [floatingCopy, setFloatingCopy] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const handleMouseUp = () => {
      setTimeout(() => {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
          try {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            if (rect.width > 0 || rect.height > 0) {
              setFloatingCopy({
                text: selection.toString(),
                x: rect.left + rect.width / 2,
                y: Math.max(10, rect.top - 45)
              });
            }
          } catch (err) {
            // Ignore range error
          }
        } else {
          setFloatingCopy(null);
        }
      }, 10);
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.closest('.floating-copy-btn')) {
        return;
      }
      setFloatingCopy(null);
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // Scroll to bottom when a new message arrives
  useEffect(() => {
    if (virtuosoRef.current) {
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({
          index: messages.length - 1,
          align: 'end',
          behavior: 'smooth'
        });
      }, 50);
    }
  }, [messages.length]);

  const handleStartReached = async () => {
    if (loadingMore || !hasMore || messages.length < 50) return;

    setLoadingMore(true);
    try {
      const oldMessages = await onLoadMore();
      if (oldMessages && oldMessages.length === 0) {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleCopyText = (msg: Message) => {
    // Check if user has text highlighted/selected on the screen from double clicking and dragging
    const selection = window.getSelection()?.toString();
    const textToCopy = (selection && selection.trim().length > 0) ? selection : msg.content;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedToast(true);
      setSelectedMessage(null);
      setTimeout(() => setCopiedToast(false), 2500);
    });
  };

  const handleDeleteForEveryone = (msg: Message) => {
    const socket = getSocket();
    if (socket) {
      socket.emit('message_delete', { messageId: msg.id, conversationId });
    }
    deleteMessage(conversationId, msg.id);
    setSelectedMessage(null);
  };

  const handleRemoveLocal = (msg: Message) => {
    removeMessage(conversationId, msg.id);
    setSelectedMessage(null);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderStatus = (msg: Message) => {
    if (msg.sender_id !== user?.id) return null;
    
    if (msg.isPending) {
      return <Clock className="w-3 h-3 text-slate-400 animate-pulse" />;
    }

    if (msg.status === 'read') {
      return <CheckCheck className="w-3.5 h-3.5 text-sky-500 stroke-[2.5]" />;
    }

    // Default sent status
    return <Check className="w-3.5 h-3.5 text-gray-400 stroke-[2]" />;
  };

  const renderMessageRow = (index: number, msg: Message) => {
    const isOwnMessage = msg.sender_id === user?.id;
    
    // Resolve sender's display name for group chats
    let senderName = '';
    if (!isOwnMessage && conversation.is_group) {
      const sender = conversation.members.find(m => m.id === msg.sender_id);
      senderName = sender ? sender.username : 'Unknown';
    }

    const prevMsg = messages[index - 1];
    const isConsecutive = prevMsg && prevMsg.sender_id === msg.sender_id;
    const isImage = msg.type === 'image' || msg.content.startsWith('data:image/') || /\.(jpeg|jpg|gif|png|webp|bmp)$/i.test(msg.content);
    const isVideo = msg.type === 'video' || msg.content.startsWith('data:video/') || /\.(mp4|mov|webm|avi|mkv)$/i.test(msg.content);
    const isDocument = msg.type === 'document' || msg.type === 'file' || (msg.content.startsWith('{') && msg.content.includes('"url"'));
    const isDeleted = msg.type === 'deleted' || msg.content === '🚫 This message was deleted';

    let docName = 'Document';
    let docSize = '';
    let docUrl = msg.content;
    if (isDocument && !isDeleted) {
      try {
        if (msg.content.startsWith('{')) {
          const parsed = JSON.parse(msg.content);
          docName = parsed.name || 'Document';
          if (parsed.size) {
            docSize = parsed.size < 1024 * 1024 
              ? `${(parsed.size / 1024).toFixed(1)} KB` 
              : `${(parsed.size / (1024 * 1024)).toFixed(1)} MB`;
          }
          docUrl = parsed.url || msg.content;
        }
      } catch (e) {
        // use default
      }
    }

    return (
      <div className={`flex flex-col px-4 md:px-8 ${isOwnMessage ? 'items-end' : 'items-start'} ${isConsecutive ? 'mt-0.5' : 'mt-2.5'}`}>
        {!isOwnMessage && conversation.is_group && !isConsecutive && (
          <span className="text-[10px] text-teal-400 font-bold mb-0.5 ml-2">
            {senderName}
          </span>
        )}
        
        <div className="flex items-start gap-2 max-w-[85%] md:max-w-[70%]">
          {/* We omit avatar icons on the chat bubbles to exactly mirror the WhatsApp clean bubble aesthetic */}
          <div 
            onDoubleClick={(e) => {
              e.stopPropagation();
              setSelectedMessage(msg);
            }}
            title="Double click for actions (Copy, Delete)"
            className={`rounded-lg px-3 py-1.5 shadow-sm flex flex-col relative cursor-pointer select-text ${
              isOwnMessage 
                ? 'bg-gradient-to-br from-teal-800/80 to-emerald-900/80 text-slate-100 rounded-tr-none border border-teal-500/40 shadow-[0_4px_12px_rgba(4,120,87,0.15),inset_0_1px_1px_rgba(255,255,255,0.2)]' 
                : 'bg-gradient-to-br from-zinc-800/90 to-slate-800/90 text-slate-100 rounded-tl-none border border-zinc-700/50 shadow-[0_4px_12px_rgba(0,0,0,0.15)]'
            }`}
          >
            {isDeleted ? (
              <p className="text-sm italic text-slate-400 pr-12 pb-1 select-none">🚫 This message was deleted</p>
            ) : isImage ? (
              <div className="pb-4 pt-1 pr-1 flex flex-col">
                <img 
                  src={msg.content} 
                  alt="Gallery Attachment" 
                  onClick={() => setViewingImage({ 
                    src: msg.content, 
                    sender: isOwnMessage ? 'You sent a photo' : `${senderName || 'Photo attachment'}`, 
                    time: msg.created_at 
                  })}
                  className="max-h-72 max-w-full rounded-lg object-contain cursor-pointer hover:opacity-95 transition shadow bg-slate-950/60 border border-white/10"
                  title="Click to view full photo"
                />
                <span className="text-[11px] text-slate-200 font-semibold mt-1.5 px-0.5 flex items-center gap-1 opacity-90 select-none">
                  📷 {isOwnMessage ? 'You sent a photo' : 'Photo'}
                </span>
              </div>
            ) : isVideo ? (
              <div className="pb-4 pt-1 pr-1 flex flex-col min-w-[220px]">
                <video 
                  src={msg.content} 
                  controls
                  className="max-h-72 max-w-full rounded-lg bg-black/80 border border-white/10 shadow"
                />
                <span className="text-[11px] text-slate-200 font-semibold mt-1.5 px-0.5 flex items-center gap-1 opacity-90 select-none">
                  🎥 {isOwnMessage ? 'You sent a video' : 'Video'}
                </span>
              </div>
            ) : isDocument ? (
              <div className="pb-4 pt-1 pr-1 flex flex-col min-w-[200px] md:min-w-[250px]">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-950/60 border border-white/10 hover:border-amber-500/50 transition">
                  <div className="p-2.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 flex items-center justify-center">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <h4 className="font-bold text-xs md:text-sm text-slate-100 truncate" title={docName}>{docName}</h4>
                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                      {docSize ? `${docSize} • ` : ''}Document
                    </span>
                  </div>
                  <a 
                    href={docUrl} 
                    download={docName}
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 rounded-full bg-white/10 hover:bg-amber-500 hover:text-slate-950 text-white transition shrink-0 cursor-pointer shadow"
                    title="Download Document"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
                <span className="text-[11px] text-slate-200 font-semibold mt-1.5 px-0.5 flex items-center gap-1 opacity-90 select-none">
                  📄 {isOwnMessage ? `You sent a document` : `Document`}
                </span>
              </div>
            ) : (
              <p className="text-sm leading-relaxed break-words pr-12 pb-1">{msg.content}</p>
            )}
            
            {/* WhatsApp-style bottom right small timestamp and checkmark */}
            <div className="absolute bottom-1 right-1.5 flex items-center gap-1 select-none text-[9px] text-slate-400">
              <span>{formatTime(msg.created_at)}</span>
              {renderStatus(msg)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 w-full min-h-0 chitchat-bg-pattern relative">
      {loadingMore && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-800/80 py-1.5 px-3 rounded-full flex items-center gap-2 z-10 shadow-md backdrop-blur-md">
          <Loader2 className="w-3.5 h-3.5 text-teal-400 animate-spin" />
          <span className="text-[10px] text-slate-200 font-bold">Loading older messages...</span>
        </div>
      )}

      {messages.length === 0 ? (
        <div className="h-full w-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
          <p className="text-sm font-bold text-slate-200">No messages yet</p>
          <p className="text-xs mt-1 text-slate-400">Send a message to start chatting!</p>
        </div>
      ) : (
        <Virtuoso
          ref={virtuosoRef}
          data={messages}
          initialTopMostItemIndex={messages.length - 1}
          followOutput="smooth"
          startReached={handleStartReached}
          itemContent={renderMessageRow}
          className="h-full w-full"
        />
      )}

      {/* Floating Drag-to-Copy Button */}
      {floatingCopy && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            navigator.clipboard.writeText(floatingCopy.text).then(() => {
              setCopiedToast(true);
              setFloatingCopy(null);
              window.getSelection()?.removeAllRanges();
              setTimeout(() => setCopiedToast(false), 2500);
            });
          }}
          style={{
            left: `${floatingCopy.x}px`,
            top: `${floatingCopy.y}px`,
            transform: 'translateX(-50%)'
          }}
          className="floating-copy-btn fixed z-50 px-3.5 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold text-xs rounded-full shadow-[0_4px_16px_rgba(20,184,166,0.6)] flex items-center gap-1.5 animate-scale-up border border-teal-300 cursor-pointer transition-all select-none"
          title="Click to copy selected text"
        >
          <Copy className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Copy</span>
        </button>
      )}

      {/* Toast Notification */}
      {copiedToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 text-xs font-bold animate-bounce select-none">
          <CheckCircle2 className="w-4 h-4" />
          <span>Copied to clipboard!</span>
        </div>
      )}

      {/* Floating Message Actions Context Menu */}
      {selectedMessage && (
        <div 
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] flex items-center justify-center animate-fade-in p-4"
          onClick={() => setSelectedMessage(null)}
        >
          <div 
            className="bg-slate-900 border border-slate-750 rounded-xl shadow-2xl p-4 w-80 max-w-full flex flex-col gap-3 text-slate-100 z-50 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                <span>Message Options</span>
              </span>
              <button onClick={() => setSelectedMessage(null)} className="text-slate-400 hover:text-white transition cursor-pointer p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message Preview snippet */}
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 max-h-24 overflow-y-auto truncate font-mono select-none">
              {selectedMessage.type === 'deleted' ? '🚫 Deleted message' :
               selectedMessage.type === 'image' ? '📷 Photo Attachment' :
               selectedMessage.type === 'video' ? '🎥 Video Attachment' :
               selectedMessage.type === 'document' ? '📄 Document Attachment' :
               selectedMessage.content}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-1.5 mt-0.5">
              {selectedMessage.type !== 'deleted' && (
                <button
                  type="button"
                  onClick={() => handleCopyText(selectedMessage)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-slate-950/50 hover:bg-slate-800 text-sm font-semibold transition text-slate-200 hover:text-teal-400 cursor-pointer border border-slate-800/80"
                >
                  <Copy className="w-4 h-4 text-teal-400 shrink-0" />
                  <span className="truncate">Copy Text / Selection</span>
                </button>
              )}

              {selectedMessage.type !== 'deleted' && (
                <button
                  type="button"
                  onClick={() => handleDeleteForEveryone(selectedMessage)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-slate-950/50 hover:bg-slate-800 text-sm font-semibold transition text-slate-200 hover:text-amber-400 cursor-pointer border border-slate-800/80"
                >
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate">Delete for Everyone</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleRemoveLocal(selectedMessage)}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-slate-950/50 hover:bg-red-950/40 text-sm font-semibold transition text-red-400 hover:text-red-300 cursor-pointer border border-slate-800/80 hover:border-red-900/50"
              >
                <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
                <span className="truncate">Delete for Me (Remove)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Photo Viewer Modal */}
      {viewingImage && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-lg flex flex-col justify-center items-center p-4 md:p-8 animate-fade-in"
          onClick={() => setViewingImage(null)}
        >
          {/* Top Header */}
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex items-center justify-between text-white z-10">
            <div className="flex flex-col">
              <span className="font-bold text-sm md:text-base text-slate-100 flex items-center gap-2">
                📷 {viewingImage.sender}
              </span>
              <span className="text-[11px] text-slate-400">
                {formatTime(viewingImage.time)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <a 
                href={viewingImage.src} 
                download="charchat_photo.jpg"
                onClick={(e) => e.stopPropagation()}
                className="p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition cursor-pointer shadow"
                title="Download Photo"
              >
                <Download className="w-5 h-5" />
              </a>
              <button 
                onClick={() => setViewingImage(null)}
                className="p-2 rounded-full bg-white/10 hover:bg-red-600 text-white transition cursor-pointer shadow"
                title="Close Viewer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Centered Image */}
          <div className="max-w-5xl max-h-[82vh] flex items-center justify-center p-2 relative">
            <img 
              src={viewingImage.src} 
              alt="Full resolution view" 
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-[82vh] object-contain rounded-lg shadow-2xl border border-white/15 select-none transition-transform duration-300"
            />
          </div>
        </div>
      )}
    </div>
  );
});
