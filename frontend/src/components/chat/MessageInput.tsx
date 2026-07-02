import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';
import { Send, Smile, Image as ImageIcon, FileText, X, Plus, Loader2, Video as VideoIcon, File } from 'lucide-react';

interface MessageInputProps {
  onSend: (content: string, type?: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
}

interface AttachmentItem {
  id: string;
  type: 'image' | 'video' | 'document';
  src: string;
  name: string;
  size: number;
}

export default function MessageInput({ onSend, onTypingStart, onTypingStop }: MessageInputProps) {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [processing, setProcessing] = useState(false);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);

    // Trigger typing indicators
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTypingStart();
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onTypingStop();
    }, 1500); // 1.5 seconds delay
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 1200;
          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = () => reject('Image load error');
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject('File read error');
      reader.readAsDataURL(file);
    });
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject('File read error');
      reader.readAsDataURL(file);
    });
  };

  const handleGalleryChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setProcessing(true);
    try {
      const newItems: AttachmentItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|avi|mkv)$/i.test(file.name);
        
        if (isVideo) {
          const dataUrl = await readFileAsDataURL(file);
          newItems.push({
            id: crypto.randomUUID(),
            type: 'video',
            src: dataUrl,
            name: file.name,
            size: file.size
          });
        } else {
          const compressed = await compressImage(file);
          newItems.push({
            id: crypto.randomUUID(),
            type: 'image',
            src: compressed,
            name: file.name,
            size: file.size
          });
        }
      }
      setAttachments((prev) => [...prev, ...newItems]);
    } catch (err) {
      console.error('Error processing gallery files:', err);
    } finally {
      setProcessing(false);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleDocChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setProcessing(true);
    try {
      const newItems: AttachmentItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = await readFileAsDataURL(file);
        newItems.push({
          id: crypto.randomUUID(),
          type: 'document',
          src: dataUrl,
          name: file.name,
          size: file.size
        });
      }
      setAttachments((prev) => [...prev, ...newItems]);
    } catch (err) {
      console.error('Error processing document files:', err);
    } finally {
      setProcessing(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && attachments.length === 0) return;

    // Send each attachment
    if (attachments.length > 0) {
      attachments.forEach((item) => {
        if (item.type === 'image') {
          onSend(item.src, 'image');
        } else if (item.type === 'video') {
          onSend(item.src, 'video');
        } else if (item.type === 'document') {
          const payload = JSON.stringify({
            name: item.name,
            size: item.size,
            url: item.src
          });
          onSend(payload, 'document');
        }
      });
    }

    // Send text if present
    if (text.trim()) {
      onSend(text.trim(), 'text');
    }

    setText('');
    setAttachments([]);
    setShowEmojiPicker(false);

    // Clear typing timeout immediately on send
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    isTypingRef.current = false;
    onTypingStop();
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setText((prev) => prev + emojiData.emoji);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <form onSubmit={handleSend} className="p-3 bg-slate-900 border-t border-slate-800 relative flex items-center gap-1.5 md:gap-2.5 shrink-0">
      
      {/* Emoji Picker Popup */}
      {showEmojiPicker && (
        <div ref={emojiPickerRef} className="absolute bottom-16 left-4 z-30 shadow-2xl border border-slate-800 rounded-lg animate-fade-in">
          <EmojiPicker 
            theme={Theme.DARK} 
            onEmojiClick={handleEmojiClick}
            lazyLoadEmojis
            skinTonesDisabled
            searchDisabled
          />
        </div>
      )}

      {/* Attachment Preview Overlay */}
      {attachments.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 p-3 bg-slate-900/95 border-t border-slate-800 backdrop-blur-md flex items-center gap-3 overflow-x-auto z-20 shadow-xl animate-fade-in">
          <div className="flex items-center gap-2.5">
            {attachments.map((item) => (
              <div key={item.id} className="relative group shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 shadow flex flex-col items-center justify-center p-1 text-center">
                {item.type === 'image' ? (
                  <img src={item.src} alt="Preview" className="w-full h-full object-cover" />
                ) : item.type === 'video' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-teal-400 p-1">
                    <VideoIcon className="w-6 h-6 mb-1" />
                    <span className="text-[9px] font-bold text-white truncate w-full">{item.name}</span>
                    <span className="text-[8px] text-zinc-400">{formatFileSize(item.size)}</span>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-amber-400 p-1">
                    <FileText className="w-6 h-6 mb-1" />
                    <span className="text-[9px] font-bold text-white truncate w-full">{item.name}</span>
                    <span className="text-[8px] text-zinc-400">{formatFileSize(item.size)}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setAttachments(prev => prev.filter(a => a.id !== item.id))}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/80 text-white opacity-0 group-hover:opacity-100 transition hover:bg-red-600 cursor-pointer"
                  title="Remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="px-3 py-1.5 rounded-md border border-slate-700 hover:border-teal-500 flex items-center gap-1.5 text-slate-300 hover:text-teal-400 transition cursor-pointer bg-slate-950/40 text-xs font-semibold"
              title="Add more photos or videos"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Media</span>
            </button>
            <button
              type="button"
              onClick={() => docInputRef.current?.click()}
              className="px-3 py-1.5 rounded-md border border-slate-700 hover:border-amber-500 flex items-center gap-1.5 text-slate-300 hover:text-amber-400 transition cursor-pointer bg-slate-950/40 text-xs font-semibold"
              title="Add more documents (.pdf, .docx, etc.)"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Doc</span>
            </button>
          </div>
          <div className="ml-auto flex items-center pl-2">
            <button
              type="button"
              onClick={() => setAttachments([])}
              className="px-3 py-2 rounded-md text-xs text-red-400 hover:text-white hover:bg-red-950/50 border border-red-900/40 transition cursor-pointer font-bold shrink-0"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Emojis Button */}
      <button
        type="button"
        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        className={`p-2 rounded-full transition text-slate-400 hover:text-teal-400 hover:bg-slate-800 shrink-0 cursor-pointer ${showEmojiPicker ? 'text-teal-400 bg-slate-800' : ''}`}
        title="Emojis"
      >
        <Smile className="w-6 h-6" />
      </button>

      {/* Gallery / Media Button (Photos & Videos) */}
      <button
        type="button"
        onClick={() => galleryInputRef.current?.click()}
        disabled={processing}
        className="p-2 rounded-full transition text-slate-400 hover:text-teal-400 hover:bg-slate-800 shrink-0 cursor-pointer disabled:opacity-50"
        title="Gallery (Photos & Videos)"
      >
        {processing ? <Loader2 className="w-6 h-6 animate-spin text-teal-400" /> : <ImageIcon className="w-6 h-6" />}
      </button>

      {/* Documents Button (Any file extension) */}
      <button
        type="button"
        onClick={() => docInputRef.current?.click()}
        disabled={processing}
        className="p-2 rounded-full transition text-slate-400 hover:text-amber-400 hover:bg-slate-800 shrink-0 cursor-pointer disabled:opacity-50"
        title="Send Document (Any extension .pdf, .docx, etc.)"
      >
        {processing ? <Loader2 className="w-6 h-6 animate-spin text-amber-400" /> : <FileText className="w-6 h-6" />}
      </button>

      {/* Hidden File Input for Gallery (Photos & Videos) */}
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/*,video/*"
        multiple
        onChange={handleGalleryChange}
        className="hidden"
      />

      {/* Hidden File Input for Documents (Any extension) */}
      <input
        type="file"
        ref={docInputRef}
        multiple
        onChange={handleDocChange}
        className="hidden"
      />

      <input
        type="text"
        value={text}
        onChange={handleInputChange}
        placeholder={attachments.length > 0 ? "Add a message or caption..." : "Type a message"}
        className="flex-1 px-4 py-2.5 rounded-lg text-slate-100 outline-none bg-slate-950 border border-slate-850 focus:border-slate-700 focus:ring-1 focus:ring-slate-700 text-sm shadow-inner placeholder-slate-500"
      />

      <button
        type="submit"
        disabled={(!text.trim() && attachments.length === 0) || processing}
        className="w-10 h-10 rounded-full bg-teal-500 hover:bg-teal-600 text-white transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer flex items-center justify-center shadow"
        title="Send Message"
      >
        {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4.5 h-4.5 translate-x-[1px]" />}
      </button>
    </form>
  );
}
