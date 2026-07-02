import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useChatStore, Conversation, User } from '../../store/store';
import { useChat } from '../../hooks/useChat';
import { LogOut, Search, MessageSquare, Users, Plus, X, Check, Loader2, Phone, Video, MessageCircle, UserPlus, AlertCircle, Settings, BookUser, Trash2 } from 'lucide-react';
import api from '../../api';

const AVATAR_COLORS = [
  { name: 'Teal', value: '#128C7E' },
  { name: 'Dark Green', value: '#075E54' },
  { name: 'Light Blue', value: '#34B7F1' },
  { name: 'Green', value: '#25D366' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Violet', value: '#8B5CF6' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Amber', value: '#F59E0B' }
];

export default function Sidebar() {
  const { user, conversations, activeConversationId, onlineUsers, typingUsers, socketConnected, logout, setActiveConversationId, calls, setCalls, deleteConversation } = useChatStore();
  const { loadConversations, createConversation, createConversationByMobile } = useChat();

  const [activeTab, setActiveTab] = useState<'chats' | 'calls'>('chats');
  const [searchQuery, setSearchQuery] = useState('');


  // Group creation modal state
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [loadingGroupUsers, setLoadingGroupUsers] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Contact creation modal state
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactMobile, setContactMobile] = useState('');
  const [contactError, setContactError] = useState('');
  const [creatingContact, setCreatingContact] = useState(false);

  // Settings modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsUsername, setSettingsUsername] = useState(user?.username || '');
  const [selectedColor, setSelectedColor] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Saved contacts book modal state
  const [showSavedContactsModal, setShowSavedContactsModal] = useState(false);
  const [savedContactsList, setSavedContactsList] = useState<any[]>([]);
  const [loadingSavedContacts, setLoadingSavedContacts] = useState(false);

  // Active chat deletion state
  const [chatToDelete, setChatToDelete] = useState<Conversation | null>(null);

  // Custom photo upload state
  const [customAvatarPreview, setCustomAvatarPreview] = useState<string | null>(null);
  const [shouldRemoveAvatar, setShouldRemoveAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getUserColor = (u: typeof user) => {
    if (u?.avatar_color) return u.avatar_color;
    if (u?.avatar_url && u.avatar_url.startsWith('data:image/svg+xml')) {
      const match = decodeURIComponent(u.avatar_url).match(/fill="([^"]+)"/);
      if (match) return match[1];
    }
    return '#128C7E';
  };

  useEffect(() => {
    if (user) {
      setSettingsUsername(user.username);
      setSelectedColor(getUserColor(user));
    }
  }, [user]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setSettingsError('Image file size should be less than 15MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      
      // Resize image to max 400x400 for fast loading and low payload size
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 400;
        let width = img.width;
        let height = img.height;

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
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
          setCustomAvatarPreview(compressedBase64);
          setShouldRemoveAvatar(false);
          setSettingsError('');
        } else {
          setCustomAvatarPreview(base64String);
          setShouldRemoveAvatar(false);
          setSettingsError('');
        }
      };
      img.onerror = () => {
        setSettingsError('Failed to process image file');
      };
      img.src = base64String;
    };
    reader.onerror = () => {
      setSettingsError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setCustomAvatarPreview(null);
    setShouldRemoveAvatar(true);
    setSettingsError('');
  };

  const getAvatarPreviewSrc = () => {
    if (shouldRemoveAvatar) {
      const initials = settingsUsername.slice(0, 2).toUpperCase();
      const color = selectedColor || '#128C7E';
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
          <rect width="100%" height="100%" fill="${color}"/>
          <text x="50%" y="54%" font-family="'Inter', Arial, sans-serif" font-size="36" font-weight="bold" fill="white" dominant-baseline="middle" text-anchor="middle">
            ${initials}
          </text>
        </svg>
      `.trim();
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }
    if (customAvatarPreview) {
      return customAvatarPreview;
    }
    return user?.avatar_url;
  };

  // Load conversations and saved contacts on mount
  useEffect(() => {
    loadConversations().catch(console.error);
    api.get('/contacts').then(res => setSavedContactsList(res.data)).catch(()=>{});
  }, [conversations.length]);

  // Fetch calls from API when switching to calls tab or on mount
  useEffect(() => {
    if (activeTab === 'calls') {
      const fetchCalls = async () => {
        try {
          const response = await api.get('/calls');
          setCalls(response.data);
        } catch (err) {
          console.error('Failed to fetch calls:', err);
        }
      };
      fetchCalls();
    }
  }, [activeTab]);

  const handleSaveSettings = async () => {
    if (!settingsUsername.trim()) {
      setSettingsError('Username is required');
      return;
    }
    setSettingsError('');
    setSettingsSuccess('');
    setSavingSettings(true);

    try {
      const response = await api.post('/auth/profile', {
        username: settingsUsername,
        avatarColor: selectedColor || undefined,
        avatarUrl: customAvatarPreview || undefined,
        removeAvatar: shouldRemoveAvatar
      });
      
      const { user: updatedUser, token: newToken } = response.data;
      useChatStore.getState().setUser(updatedUser, newToken);
      setSettingsSuccess('Profile updated successfully!');
      
      setCustomAvatarPreview(null);
      setShouldRemoveAvatar(false);
      
      setTimeout(() => {
        setSettingsSuccess('');
      }, 3000);
    } catch (err: any) {
      console.error('Failed to update profile settings:', err);
      setSettingsError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSavingSettings(false);
    }
  };

  const formatCallTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (date.toDateString() === today.toDateString()) {
      return `Today, ${timeStr}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${timeStr}`;
    } else {
      return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
    }
  };

  // Search now filters savedContactsList locally without calling backend for unknown users

  // Load all users when group modal opens
  useEffect(() => {
    if (showGroupModal) {
      setLoadingGroupUsers(true);
      api.get('/users')
        .then(res => {
          setAvailableUsers(res.data);
        })
        .catch(err => {
          console.error('Failed to fetch users for group:', err);
        })
        .finally(() => {
          setLoadingGroupUsers(false);
        });
    } else {
      setGroupName('');
      setSelectedUserIds([]);
    }
  }, [showGroupModal]);

  // Load saved contacts when modal opens
  useEffect(() => {
    if (showSavedContactsModal) {
      setLoadingSavedContacts(true);
      api.get('/contacts')
        .then(res => setSavedContactsList(res.data))
        .catch(err => console.error('Failed to load saved contacts:', err))
        .finally(() => setLoadingSavedContacts(false));
    }
  }, [showSavedContactsModal]);

  const handleDeleteSavedContact = async (contactId: string) => {
    try {
      await api.delete(`/contacts/${contactId}`);
      setSavedContactsList(prev => prev.filter(c => c.id !== contactId && c.saved_contact_id !== contactId));
    } catch (err) {
      console.error('Failed to delete saved contact:', err);
    }
  };

  const handleDeleteActiveChat = async (conv: Conversation) => {
    try {
      await api.delete(`/conversations/${conv.id}`);
      deleteConversation(conv.id);
      setChatToDelete(null);
    } catch (err) {
      console.error('Failed to delete active chat:', err);
    }
  };

  const handleStart1on1 = async (targetUser: User) => {
    try {
      setSearchQuery('');
      const conv = await createConversation([targetUser.id], false);
      setActiveConversationId(conv.id);
      setActiveTab('chats');
    } catch (err) {
      console.error('Failed to start chat:', err);
    }
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactMobile.trim()) {
      setContactError('Please enter a 10-digit mobile number');
      return;
    }

    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(contactMobile)) {
      setContactError('Mobile number must be exactly 10 digits');
      return;
    }

    setContactError('');
    setCreatingContact(true);
    try {
      await createConversationByMobile(contactName.trim() || `Contact ${contactMobile.trim()}`, contactMobile.trim());
      setShowContactModal(false);
      setContactName('');
      setContactMobile('');
      api.get('/contacts').then(res => setSavedContactsList(res.data)).catch(()=>{});
    } catch (err: any) {
      console.error(err);
      setContactError(err.response?.data?.error || 'Failed to create contact. Try another username.');
    } finally {
      setCreatingContact(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || selectedUserIds.length === 0) return;

    setCreatingGroup(true);
    try {
      const conv = await createConversation(selectedUserIds, true, groupName);
      setActiveConversationId(conv.id);
      setShowGroupModal(false);
      setActiveTab('chats');
    } catch (err) {
      console.error('Failed to create group:', err);
    } finally {
      setCreatingGroup(false);
    }
  };

  const toggleSelectUserForGroup = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((acc, conv) => acc + conv.unread_count, 0);
  }, [conversations]);

  // Helper to resolve conversation title and avatar
  const getConversationDetails = (conv: Conversation) => {
    if (conv.is_group) {
      return {
        title: conv.name || 'Group Chat',
        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(conv.id)}`,
        isOnline: false
      };
    }

    const peer = conv.members.find(m => m.id !== user?.id) || conv.members[0];
    
    if (!peer) {
      return { title: 'Saved Messages', avatar: user?.avatar_url || '', isOnline: true };
    }

    const isPeerOnline = onlineUsers.includes(peer.id) || peer.status === 'online';

    return {
      title: peer.username,
      avatar: peer.avatar_url,
      isOnline: isPeerOnline
    };
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Only show active chats (with at least one message or currently open)
  const activeChatsList = useMemo(() => {
    return conversations.filter(c => c.last_message || c.id === activeConversationId);
  }, [conversations, activeConversationId]);

  // Filter saved contacts locally when user searches
  const filteredSavedContacts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return savedContactsList.filter(c => 
      (c.contact_name && c.contact_name.toLowerCase().includes(q)) ||
      (c.contact_mobile && c.contact_mobile.includes(q)) ||
      (c.username && c.username.toLowerCase().includes(q)) ||
      (c.mobile && c.mobile.includes(q))
    );
  }, [searchQuery, savedContactsList]);

  return (
    <div className="w-80 md:w-96 flex flex-col h-full bg-slate-950 border-r border-slate-900 relative shrink-0">
      
      {/* CharChat Header */}
      <div className="bg-slate-900 border-b border-slate-800/80 text-white px-4 pt-4 pb-1 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-extrabold tracking-wide text-teal-400">CharChat</h2>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowContactModal(true)}
              title="Create New Contact"
              className="p-1 rounded hover:bg-white/10 text-zinc-450 hover:text-white transition-colors"
            >
              <UserPlus className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setShowGroupModal(true)}
              title="New Group Chat"
              className="p-1 rounded hover:bg-white/10 text-zinc-450 hover:text-white transition-colors"
            >
              <Users className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setShowSavedContactsModal(true)}
              title="Saved Contacts Book"
              className="p-1 rounded hover:bg-white/10 text-zinc-450 hover:text-teal-400 transition-colors cursor-pointer"
            >
              <BookUser className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setShowSettingsModal(true)}
              title="Settings"
              className="p-1 rounded hover:bg-white/10 text-zinc-455 hover:text-white transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
            {/* User Profile Avatar Beside Settings Icon */}
            <img 
              src={user?.avatar_url} 
              alt="My Avatar"
              onClick={() => setShowSettingsModal(true)}
              className="w-6 h-6 rounded-full border-[2.5px] cursor-pointer object-cover transition-all shrink-0 ml-1.5 shadow-md active:scale-95 hover:scale-110" 
              style={{ borderColor: getUserColor(user), boxShadow: `0 0 10px ${getUserColor(user)}99` }}
              title="Profile Settings"
            />
          </div>
        </div>

        {/* Tabs (Chats, Calls) */}
        <div className="flex text-center text-sm font-semibold tracking-wider uppercase mt-2 select-none">
          <button 
            onClick={() => setActiveTab('chats')}
            className={`flex-1 pb-3 relative flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === 'chats' ? 'text-teal-400 border-b-[3px] border-teal-500' : 'text-zinc-400 hover:text-white'}`}
          >
            <span>CHATS</span>
            {totalUnreadCount > 0 && (
              <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-slate-950 bg-teal-400 rounded-full leading-none">
                {totalUnreadCount}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('calls')}
            className={`flex-1 pb-3 cursor-pointer ${activeTab === 'calls' ? 'text-teal-400 border-b-[3px] border-teal-500' : 'text-zinc-400 hover:text-white'}`}
          >
            CALLS
          </button>
        </div>
      </div>

      {/* Main Tab View Area */}
      <div className="flex-1 overflow-y-auto bg-slate-950 flex flex-col">
        {activeTab === 'chats' && (
          <>
            {/* Search Input inside Chats */}
            <div className="p-3 bg-slate-900/40 border-b border-slate-900/60">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-550" />
                <input
                  type="text"
                  placeholder="Search or start new chat..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 text-xs text-white border border-slate-800 outline-none rounded-full bg-slate-950/80 focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-all placeholder-zinc-550 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Conversation List / Search Results */}
            <div className="flex-1">
              {searchQuery.trim().length > 0 ? (
                /* Search results */
                <div className="p-2 space-y-1">
                  <h4 className="px-3 py-1.5 text-[10px] font-bold text-teal-400 uppercase tracking-wider">Saved Contacts Matching "{searchQuery}"</h4>
                  {filteredSavedContacts.length === 0 ? (
                    <p className="text-zinc-500 text-xs text-center py-8">No saved contacts found</p>
                  ) : (
                    filteredSavedContacts.map((contact) => {
                      const isOnline = onlineUsers.includes(contact.id) || contact.status === 'online';
                      return (
                        <button
                          key={contact.saved_contact_id || contact.id}
                          onClick={() => handleStart1on1(contact)}
                          className="w-full flex items-center gap-3.5 p-3 rounded-lg hover:bg-slate-900/60 transition text-left cursor-pointer border-b border-slate-900/30"
                        >
                          <div className="relative shrink-0">
                            <img src={contact.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(contact.id)}`} alt={contact.contact_name || contact.username} className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800" />
                            <span className={`absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-slate-950 ${isOnline ? 'bg-green-500' : 'bg-zinc-600'}`}></span>
                          </div>
                          <div>
                            <p className="font-bold text-white text-sm">{contact.contact_name || contact.username}</p>
                            <span className="text-[10px] text-zinc-450">
                              {contact.contact_mobile || contact.mobile} • {isOnline ? 'Online' : 'Offline'}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              ) : (
                /* Chats lists and New Users */
                <div className="flex flex-col">
                  
                  {/* Active Conversations */}
                  {activeChatsList.length > 0 ? (
                    <div className="flex flex-col border-b border-slate-900">
                      <h4 className="px-3.5 py-2 text-[10px] font-bold text-teal-400 uppercase tracking-wider bg-slate-900/30 border-b border-slate-900 select-none">Active Chats</h4>
                      <div className="divide-y divide-slate-950">
                        {activeChatsList.map((conv) => {
                          const { title, avatar, isOnline } = getConversationDetails(conv);
                          const isActive = activeConversationId === conv.id;
                          
                          const typers = typingUsers[conv.id] || [];
                          const typingText = typers.length > 0 
                            ? `${typers.map(t => t.username).join(', ')} is typing...` 
                            : '';

                          return (
                            <div
                              key={conv.id}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setChatToDelete(conv);
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setChatToDelete(conv);
                              }}
                              onClick={() => setActiveConversationId(conv.id)}
                              className={`w-full flex items-center gap-3.5 p-3.5 transition text-left cursor-pointer relative ${isActive ? 'bg-slate-900/80 shadow-inner' : 'hover:bg-slate-900/30 border-b border-slate-950/40'}`}
                            >
                              <div className="relative shrink-0">
                                <img src={avatar} alt={title} className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800" />
                                {!conv.is_group && (
                                  <span className={`absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-slate-950 ${isOnline ? 'bg-green-500' : 'bg-zinc-600'}`}></span>
                                )}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-0.5">
                                  <h4 className="font-bold text-white text-sm truncate">{title}</h4>
                                  {conv.last_message && (
                                    <span className={`text-[10px] whitespace-nowrap ml-2 ${conv.unread_count > 0 ? 'text-teal-400 font-bold' : 'text-zinc-500'}`}>
                                      {formatTime(conv.last_message.created_at)}
                                    </span>
                                  )}
                                </div>

                                <div className="flex justify-between items-center">
                                  {typingText ? (
                                    <span className="text-xs text-teal-400 font-medium truncate pulse-active">{typingText}</span>
                                  ) : conv.last_message ? (
                                    <span className="text-xs text-zinc-400 truncate flex-1 pr-2">
                                      {(() => {
                                        const msg = conv.last_message!;
                                        const isOwn = msg.sender_id === user?.id;
                                        if (msg.type === 'image' || msg.content.startsWith('data:image/') || /\.(jpeg|jpg|gif|png|webp|bmp)$/i.test(msg.content)) {
                                          return isOwn ? '📷 You sent a photo' : '📷 Photo';
                                        }
                                        if (msg.type === 'video' || msg.content.startsWith('data:video/') || /\.(mp4|mov|webm|avi|mkv)$/i.test(msg.content)) {
                                          return isOwn ? '🎥 You sent a video' : '🎥 Video';
                                        }
                                        if (msg.type === 'document' || msg.type === 'file' || (msg.content.startsWith('{') && msg.content.includes('"url"'))) {
                                          let docTitle = 'a document';
                                          try { if (msg.content.startsWith('{')) docTitle = JSON.parse(msg.content).name || 'a document'; } catch(e){}
                                          return isOwn ? `📄 You sent ${docTitle}` : `📄 ${docTitle}`;
                                        }
                                        return `${isOwn ? 'You: ' : ''}${msg.content}`;
                                      })()}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-zinc-650 truncate flex-1 italic">No messages yet</span>
                                  )}

                                  {conv.unread_count > 0 && (
                                    <span className="h-5 min-w-[20px] px-1.5 flex items-center justify-center text-[10px] font-bold text-slate-950 bg-teal-400 rounded-full shrink-0 shadow-md">
                                      {conv.unread_count}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-zinc-600 text-center px-4">
                      <MessageSquare className="w-10 h-10 text-slate-800 mb-2 opacity-50" />
                      <p className="text-xs font-bold text-slate-400">No active chats</p>
                      <p className="text-[10px] text-zinc-500 mt-1">Open your Saved Contacts Book or search to start a conversation.</p>
                    </div>
                  )}

                </div>
              )}
            </div>
          </>
        )}

        {/* Call Logs Tab */}
        {activeTab === 'calls' && (
          <div className="p-3 space-y-2 flex-1 flex flex-col overflow-y-auto bg-slate-950">
            <h4 className="text-[11px] font-bold text-teal-400 uppercase tracking-wider px-1">Recent Calls</h4>
            {calls.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-8 select-none">
                <Phone className="w-10 h-10 text-slate-800 mb-2 animate-pulse" />
                <p className="text-xs text-center font-bold">No call logs yet</p>
                <p className="text-[10px] text-center mt-1 text-zinc-600">Calls you make will show up here.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-900">
                {calls.map((call) => (
                  <div key={call.id} className="flex items-center justify-between py-3 px-2 hover:bg-slate-900/30 rounded-lg transition cursor-pointer border-b border-slate-950/30">
                    <div className="flex items-center gap-3.5">
                      <img src={call.peer.avatar_url} alt={call.peer.username} className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800" />
                      <div>
                        <h5 className="font-bold text-white text-sm">{call.peer.username}</h5>
                        <p className="text-zinc-500 text-xs mt-0.5 flex items-center gap-1">
                          {call.isOutgoing ? (
                            <span className="text-green-500 font-bold">↗</span>
                          ) : (
                            <span className="text-blue-500 font-bold">↙</span>
                          )}
                          {formatCallTime(call.timestamp)}
                        </p>
                      </div>
                    </div>
                    {call.type === 'voice' ? (
                      <Phone className="w-5 h-5 text-teal-400 shrink-0 mr-1" />
                    ) : (
                      <Video className="w-5 h-5 text-teal-400 shrink-0 mr-1" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) at Bottom Right */}
      <button 
        onClick={() => setShowContactModal(true)}
        className="absolute bottom-6 right-6 w-14 h-14 bg-teal-500 rounded-full flex items-center justify-center text-slate-950 fab-shadow transition-transform hover:scale-105 hover:bg-teal-650 shrink-0 cursor-pointer z-10"
        title="Create New Contact"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Create Contact Modal */}
      {showContactModal && (
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-20 flex flex-col justify-end animate-fade-in">
          <div className="bg-slate-900 border-t border-slate-800 rounded-t-2xl p-4 max-h-[80%] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-teal-400" />
                Create New Contact
              </h3>
              <button 
                onClick={() => {
                  setShowContactModal(false);
                  setContactName('');
                  setContactMobile('');
                  setContactError('');
                }}
                className="p-1.5 rounded-full bg-slate-800 text-zinc-400 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {contactError && (
              <div className="mb-4 p-3 rounded-md bg-red-950/30 border border-red-900/50 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-red-400 text-xs font-medium">{contactError}</p>
              </div>
            )}

            <form onSubmit={handleCreateContact} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-teal-400 uppercase tracking-wider">Contact Name</label>
                <input
                  type="text"
                  placeholder="e.g. Bob"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm text-white border border-slate-800 bg-slate-950/80 outline-none rounded-md focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-all placeholder-zinc-550 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
                  disabled={creatingContact}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-teal-400 uppercase tracking-wider">Contact Number</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={contactMobile}
                  onChange={(e) => setContactMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full px-4 py-2.5 text-sm text-white border border-slate-800 bg-slate-950/80 outline-none rounded-md focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-all placeholder-zinc-550 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
                  disabled={creatingContact}
                />
              </div>

              <button
                type="submit"
                disabled={creatingContact || contactMobile.length !== 10}
                className="w-full py-2.5 rounded-md bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-sm tracking-wider transition shadow-md disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {creatingContact ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    ADDING CONTACT...
                  </>
                ) : (
                  'ADD CONTACT & START CHAT'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Group Chat Creation Modal */}
      {showGroupModal && (
        <div className="absolute inset-0 bg-slate-955/70 backdrop-blur-sm z-20 flex flex-col justify-end animate-fade-in">
          <div className="bg-slate-900 border-t border-slate-800 rounded-t-2xl p-4 max-h-[85%] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-400" />
                Create Group Chat
              </h3>
              <button 
                onClick={() => setShowGroupModal(false)}
                className="p-1.5 rounded-full bg-slate-800 text-zinc-400 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="flex-1 flex flex-col overflow-hidden space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-teal-400 uppercase tracking-wider">Group Name</label>
                <input
                  type="text"
                  placeholder="e.g. Work Team"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm text-white border border-slate-800 bg-slate-955/85 outline-none rounded-md focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-all placeholder-zinc-550 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
                />
              </div>

              <div className="flex-1 flex flex-col overflow-hidden space-y-1.5">
                <label className="text-[11px] font-bold text-teal-400 uppercase tracking-wider">
                  Select Members ({selectedUserIds.length})
                </label>
                
                <div className="flex-1 overflow-y-auto border border-slate-800 rounded-md p-2 divide-y divide-slate-850 bg-slate-950/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
                  {loadingGroupUsers ? (
                    <div className="flex items-center justify-center py-6 text-zinc-500 gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs">Loading users...</span>
                    </div>
                  ) : availableUsers.length === 0 ? (
                    <p className="text-zinc-650 text-xs text-center py-6">No members available</p>
                  ) : (
                    availableUsers.map((item) => {
                      const isSelected = selectedUserIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleSelectUserForGroup(item.id)}
                          className="flex items-center justify-between p-2 hover:bg-slate-800 rounded-md cursor-pointer transition"
                        >
                          <div className="flex items-center gap-2">
                            <img src={item.avatar_url} alt={item.username} className="w-8 h-8 rounded-full bg-slate-800" />
                            <span className="text-sm text-white font-medium">{item.username}</span>
                          </div>
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${isSelected ? 'bg-teal-500 border-teal-500 text-slate-950' : 'border-zinc-550 bg-transparent'}`}>
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={creatingGroup || !groupName.trim() || selectedUserIds.length === 0}
                className="w-full py-2.5 rounded-md bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-sm tracking-wider transition shadow-md disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {creatingGroup ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    CREATING GROUP...
                  </>
                ) : (
                  'CREATE GROUP'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="absolute inset-0 bg-slate-955/70 backdrop-blur-sm z-20 flex flex-col justify-end animate-fade-in">
          <div className="bg-slate-900 border-t border-slate-800 rounded-t-2xl p-4 max-h-[85%] flex flex-col shadow-2xl overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-teal-400" />
                Profile Settings
              </h3>
              <button 
                onClick={() => {
                  setShowSettingsModal(false);
                  setSettingsError('');
                  setSettingsSuccess('');
                  setSelectedColor('');
                  setCustomAvatarPreview(null);
                  setShouldRemoveAvatar(false);
                }}
                className="p-1.5 rounded-full bg-slate-800 text-zinc-400 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {settingsError && (
              <div className="mb-4 p-3 rounded-md bg-red-950/30 border border-red-900/50 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-red-400 text-xs font-medium">{settingsError}</p>
              </div>
            )}

            {settingsSuccess && (
              <div className="mb-4 p-3 rounded-md bg-green-950/20 border border-green-900/30 flex items-start gap-2.5">
                <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                <p className="text-green-400 text-xs font-medium">{settingsSuccess}</p>
              </div>
            )}

            <div className="space-y-4 flex-1">
              {/* Profile Avatar Preview */}
              <div className="flex flex-col items-center justify-center py-2">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="relative group cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                  title="Upload New Photo"
                >
                  <img 
                    src={getAvatarPreviewSrc()} 
                    alt={user?.username} 
                    className="w-24 h-24 rounded-full border-4 bg-slate-950 object-cover shadow-xl animate-fade-in transition-all" 
                    style={{ borderColor: selectedColor || getUserColor(user), boxShadow: `0 0 20px ${(selectedColor || getUserColor(user))}88` }}
                  />
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-xs font-bold">Change</span>
                  </div>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="image/*" 
                  onChange={handleImageChange} 
                  className="hidden" 
                />
                
                <div className="flex gap-4 mt-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-md border border-slate-800 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Upload Photo
                  </button>
                  {((user?.avatar_url && !user.avatar_url.startsWith('data:image/svg+xml')) || customAvatarPreview) && !shouldRemoveAvatar && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="px-3 py-1.5 rounded-md border border-red-900 bg-red-950/20 hover:bg-red-950/50 text-red-400 text-xs font-bold transition cursor-pointer"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>
              </div>

              {/* Verified Mobile */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-teal-400 uppercase tracking-wider">Mobile Number (Read-only)</label>
                <input
                  type="text"
                  readOnly
                  value={user?.mobile || ''}
                  className="w-full px-4 py-2 text-sm text-zinc-300 border border-slate-800 outline-none rounded-md bg-slate-900/90 cursor-not-allowed font-mono"
                />
              </div>

              {/* Username Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-teal-400 uppercase tracking-wider">Username</label>
                <input
                  type="text"
                  required
                  placeholder="Username"
                  value={settingsUsername}
                  onChange={(e) => setSettingsUsername(e.target.value.replace(/\s+/g, ''))}
                  className="w-full px-4 py-2.5 text-sm text-white border border-slate-700 bg-[#0b0f19] outline-none rounded-md focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-all placeholder-zinc-500 shadow-inner font-medium"
                  disabled={savingSettings}
                />
              </div>

              {/* Avatar Background Color Selection */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-teal-400 uppercase tracking-wider block">Initials Avatar Color</label>
                <div className="grid grid-cols-4 gap-3">
                  {AVATAR_COLORS.map((color) => {
                    const isSelected = selectedColor === color.value;
                    return (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setSelectedColor(color.value)}
                        className={`w-10 h-10 rounded-full cursor-pointer transition-all flex items-center justify-center ${isSelected ? 'ring-4 ring-white ring-offset-2 ring-offset-slate-900 scale-110 shadow-xl' : 'hover:scale-105 opacity-80 hover:opacity-100'}`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      >
                        {isSelected && <Check className="w-5 h-5 text-white stroke-[3] drop-shadow-md" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Save Settings */}
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings || !settingsUsername.trim()}
                className="w-full py-2.5 rounded-md bg-teal-500 hover:bg-teal-600 text-slate-955 font-bold text-sm tracking-wider transition shadow-md disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {savingSettings ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    SAVING PROFILE...
                  </>
                ) : (
                  'SAVE PROFILE'
                )}
              </button>

              <hr className="border-slate-800 my-4" />

              {/* Log Out */}
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  logout();
                }}
                className="w-full py-2.5 rounded-md border border-red-900 bg-red-950/20 hover:bg-red-950/50 text-red-400 font-bold text-sm tracking-wider transition cursor-pointer flex items-center justify-center gap-2"
              >
                <LogOut className="w-4.5 h-4.5" />
                LOG OUT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved Contacts Book Modal */}
      {showSavedContactsModal && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-30 flex flex-col justify-center items-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-sm p-4 max-h-[85%] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BookUser className="w-5 h-5 text-teal-400" />
                Saved Contacts Book
              </h3>
              <button 
                onClick={() => setShowSavedContactsModal(false)}
                className="p-1.5 rounded-full bg-slate-800 text-zinc-400 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 min-h-[150px]">
              {loadingSavedContacts ? (
                <div className="flex items-center justify-center py-10 text-zinc-500 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
                  <span className="text-xs font-semibold">Loading saved contacts...</span>
                </div>
              ) : savedContactsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-zinc-500 text-center">
                  <BookUser className="w-10 h-10 text-slate-800 mb-2" />
                  <p className="text-xs font-bold text-slate-300">No saved contacts yet</p>
                  <p className="text-[10px] text-zinc-500 mt-1">Contacts you add via mobile number will appear here.</p>
                </div>
              ) : (
                savedContactsList.map((contact) => (
                  <div key={contact.saved_contact_id || contact.id} className="flex items-center justify-between py-3 px-2 hover:bg-slate-950/40 rounded-lg transition">
                    <div 
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                      onClick={() => {
                        handleStart1on1(contact);
                        setShowSavedContactsModal(false);
                      }}
                    >
                      <img src={contact.avatar_url} alt={contact.custom_name || contact.username} className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 shrink-0 object-cover" />
                      <div className="min-w-0 flex-1 pr-2">
                        <h4 className="font-bold text-sm text-white truncate">{contact.custom_name || contact.username}</h4>
                        <p className="text-[11px] text-teal-400 font-mono mt-0.5">{contact.mobile}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSavedContact(contact.saved_contact_id || contact.id);
                      }}
                      title="Delete Saved Contact"
                      className="p-2 rounded-lg bg-red-950/20 hover:bg-red-900/40 text-red-400 hover:text-red-300 transition shrink-0 cursor-pointer border border-red-900/30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Active Chat Confirmation Modal */}
      {chatToDelete && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-30 flex flex-col justify-center items-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-sm p-5 flex flex-col shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-3 border border-red-500/30">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-white mb-1">Delete Active Chat?</h3>
            <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
              Are you sure you want to delete <span className="text-teal-400 font-bold">{getConversationDetails(chatToDelete).title}</span> from your active chats?
              <br />
              <span className="text-[10px] text-zinc-500 block mt-1.5">(This removes the chat from your list, but keeps the contact in your Saved Contacts book).</span>
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setChatToDelete(null)}
                className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-zinc-300 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteActiveChat(chatToDelete)}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition cursor-pointer shadow-lg"
              >
                Delete Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
