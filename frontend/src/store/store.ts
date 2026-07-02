import { create } from 'zustand';

export interface User {
  id: string;
  username: string;
  avatar_url: string;
  avatar_color?: string;
  status: string;
  last_seen: number;
  mobile: string;
}

export interface Call {
  id: string;
  type: 'voice' | 'video';
  timestamp: number;
  isOutgoing: boolean;
  peer: {
    id: string;
    username: string;
    avatar_url: string;
    avatar_color?: string;
  };
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: string;
  status: 'sent' | 'delivered' | 'read';
  mood?: string | null;
  unlock_at?: number | null;
  interactive_type?: string | null;
  interactive_data?: string | null;
  created_at: number;
  isPending?: boolean; // True if sent offline and awaiting server response
}

export interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  created_at: number;
  members: User[];
  last_message: Message | null;
  unread_count: number;
}

export interface OfflineMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: string;
  mood?: string | null;
  unlock_at?: number | null;
  interactive_type?: string | null;
  interactive_data?: string | null;
  created_at: number;
}

interface ChatState {
  user: User | null;
  token: string | null;
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>; // conversationId -> messages
  onlineUsers: string[]; // List of online user IDs
  typingUsers: Record<string, { userId: string; username: string }[]>; // conversationId -> typers
  socketConnected: boolean;
  offlineQueue: OfflineMessage[];
  calls: Call[];
  preferredLanguage: string;
  smartSilentMode: boolean;

  // Actions
  setUser: (user: User | null, token: string | null) => void;
  logout: () => void;
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  setActiveConversationId: (id: string | null) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessageStatus: (conversationId: string, messageId: string, status: 'sent' | 'delivered' | 'read') => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  markMessagesAsRead: (conversationId: string, readerUserId: string) => void;
  setOnlineUsers: (userIds: string[]) => void;
  updateUserPresence: (userId: string, status: string, lastSeen: number) => void;
  setSocketConnected: (connected: boolean) => void;
  setTypingStatus: (conversationId: string, userId: string, username: string, isTyping: boolean) => void;
  enqueueOfflineMessage: (msg: OfflineMessage) => void;
  dequeueOfflineMessage: (msgId: string) => void;
  clearOfflineQueue: () => void;
  setCalls: (calls: Call[]) => void;
  addCall: (call: Call) => void;
  deleteConversation: (id: string) => void;
  setPreferredLanguage: (lang: string) => void;
  setSmartSilentMode: (enabled: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  user: JSON.parse(localStorage.getItem('chat_user') || 'null'),
  token: localStorage.getItem('chat_token'),
  conversations: [],
  activeConversationId: null,
  messages: {},
  onlineUsers: [],
  typingUsers: {},
  socketConnected: false,
  offlineQueue: JSON.parse(localStorage.getItem('chat_offline_queue') || '[]'),
  calls: [],
  preferredLanguage: localStorage.getItem('chat_pref_lang') || 'en',
  smartSilentMode: localStorage.getItem('chat_smart_silent') === 'true',

  setUser: (user, token) => {
    if (user && token) {
      localStorage.setItem('chat_user', JSON.stringify(user));
      localStorage.setItem('chat_token', token);
    } else {
      localStorage.removeItem('chat_user');
      localStorage.removeItem('chat_token');
    }
    set({ user, token });
  },

  logout: () => {
    localStorage.removeItem('chat_user');
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_offline_queue');
    set({
      user: null,
      token: null,
      conversations: [],
      activeConversationId: null,
      messages: {},
      onlineUsers: [],
      typingUsers: {},
      socketConnected: false,
      offlineQueue: [],
      calls: [],
    });
  },

  setPreferredLanguage: (lang) => {
    localStorage.setItem('chat_pref_lang', lang);
    set({ preferredLanguage: lang });
  },

  setSmartSilentMode: (enabled) => {
    localStorage.setItem('chat_smart_silent', String(enabled));
    set({ smartSilentMode: enabled });
  },

  setCalls: (calls) => set({ calls }),

  addCall: (call) => set((state) => ({ calls: [call, ...state.calls] })),

  setConversations: (conversations) => set({ conversations }),

  addConversation: (conversation) => set((state) => {
    // Avoid duplicate conversations
    if (state.conversations.some(c => c.id === conversation.id)) return {};
    return { conversations: [conversation, ...state.conversations] };
  }),

  deleteConversation: (id) => set((state) => ({
    conversations: state.conversations.filter(c => c.id !== id),
    activeConversationId: state.activeConversationId === id ? null : state.activeConversationId
  })),

  setActiveConversationId: (id) => set((state) => {
    // If we open a conversation, clear its unread count locally
    const conversations = state.conversations.map(c => 
      c.id === id ? { ...c, unread_count: 0 } : c
    );
    return { activeConversationId: id, conversations };
  }),

  setMessages: (conversationId, messages) => set((state) => ({
    messages: { ...state.messages, [conversationId]: messages }
  })),

  addMessage: (conversationId, message) => set((state) => {
    const chatMsgs = state.messages[conversationId] || [];
    
    // Check if message is already in list (e.g. from offline sync or other tab)
    const exists = chatMsgs.some(m => m.id === message.id);
    const updatedMsgs = exists 
      ? chatMsgs.map(m => m.id === message.id ? { ...m, ...message, isPending: false } : m)
      : [...chatMsgs, message];

    // Sort chronologically just in case
    updatedMsgs.sort((a, b) => a.created_at - b.created_at);

    // Update conversation's last message and increment unread if active chat is different
    const isCurrentActive = state.activeConversationId === conversationId;
    const isOwnMessage = message.sender_id === state.user?.id;
    
    const conversations = state.conversations.map(c => {
      if (c.id === conversationId) {
        return {
          ...c,
          last_message: message,
          unread_count: (!isCurrentActive && !isOwnMessage) ? c.unread_count + 1 : c.unread_count
        };
      }
      return c;
    });

    // Reorder conversations so the active one goes to top
    conversations.sort((a, b) => {
      const timeA = a.last_message ? a.last_message.created_at : a.created_at;
      const timeB = b.last_message ? b.last_message.created_at : b.created_at;
      return timeB - timeA;
    });

    return {
      messages: { ...state.messages, [conversationId]: updatedMsgs },
      conversations
    };
  }),

  updateMessageStatus: (conversationId, messageId, status) => set((state) => {
    const chatMsgs = state.messages[conversationId] || [];
    const updatedMsgs = chatMsgs.map(m => 
      m.id === messageId ? { ...m, status } : m
    );
    
    // Update last message status in conversation list as well if it matches
    const conversations = state.conversations.map(c => {
      if (c.id === conversationId && c.last_message?.id === messageId) {
        return { ...c, last_message: { ...c.last_message, status } };
      }
      return c;
    });

    return {
      messages: { ...state.messages, [conversationId]: updatedMsgs },
      conversations
    };
  }),

  deleteMessage: (conversationId, messageId) => set((state) => {
    const chatMsgs = state.messages[conversationId] || [];
    const updatedMsgs = chatMsgs.map(m => 
      m.id === messageId ? { ...m, content: '🚫 This message was deleted', type: 'deleted' } : m
    );
    const conversations = state.conversations.map(c => {
      if (c.id === conversationId && c.last_message?.id === messageId) {
        return { ...c, last_message: { ...c.last_message, content: '🚫 This message was deleted', type: 'deleted' } };
      }
      return c;
    });
    return {
      messages: { ...state.messages, [conversationId]: updatedMsgs },
      conversations
    };
  }),

  removeMessage: (conversationId, messageId) => set((state) => {
    const chatMsgs = state.messages[conversationId] || [];
    const updatedMsgs = chatMsgs.filter(m => m.id !== messageId);
    return {
      messages: { ...state.messages, [conversationId]: updatedMsgs }
    };
  }),

  markMessagesAsRead: (conversationId, readerUserId) => set((state) => {
    const chatMsgs = state.messages[conversationId] || [];
    
    // Update all messages where sender is not the reader
    const updatedMsgs = chatMsgs.map(m => 
      m.sender_id !== readerUserId ? { ...m, status: 'read' as const } : m
    );

    const conversations = state.conversations.map(c => {
      if (c.id === conversationId) {
        const lastMsg = c.last_message;
        const updatedLastMsg = lastMsg && lastMsg.sender_id !== readerUserId 
          ? { ...lastMsg, status: 'read' as const } 
          : lastMsg;
        
        return {
          ...c,
          last_message: updatedLastMsg,
          // If reader is current user, clear unread count
          unread_count: readerUserId === state.user?.id ? 0 : c.unread_count
        };
      }
      return c;
    });

    return {
      messages: { ...state.messages, [conversationId]: updatedMsgs },
      conversations
    };
  }),

  setOnlineUsers: (onlineUsers) => set({ onlineUsers }),

  updateUserPresence: (userId, status, lastSeen) => set((state) => {
    // 1. Update online users list
    let onlineUsers = [...state.onlineUsers];
    if (status === 'online' && !onlineUsers.includes(userId)) {
      onlineUsers.push(userId);
    } else if (status === 'offline') {
      onlineUsers = onlineUsers.filter(id => id !== userId);
    }

    // 2. Update user info inside conversations members
    const conversations = state.conversations.map(c => {
      const members = c.members.map(m => 
        m.id === userId ? { ...m, status, last_seen: lastSeen } : m
      );
      return { ...c, members };
    });

    return { onlineUsers, conversations };
  }),

  setSocketConnected: (socketConnected) => set({ socketConnected }),

  setTypingStatus: (conversationId, userId, username, isTyping) => set((state) => {
    const typers = state.typingUsers[conversationId] || [];
    const updatedTypers = isTyping
      ? [...typers.filter(t => t.userId !== userId), { userId, username }]
      : typers.filter(t => t.userId !== userId);

    return {
      typingUsers: { ...state.typingUsers, [conversationId]: updatedTypers }
    };
  }),

  enqueueOfflineMessage: (msg) => set((state) => {
    const updatedQueue = [...state.offlineQueue, msg];
    localStorage.setItem('chat_offline_queue', JSON.stringify(updatedQueue));
    return { offlineQueue: updatedQueue };
  }),

  dequeueOfflineMessage: (msgId) => set((state) => {
    const updatedQueue = state.offlineQueue.filter(m => m.id !== msgId);
    localStorage.setItem('chat_offline_queue', JSON.stringify(updatedQueue));
    return { offlineQueue: updatedQueue };
  }),

  clearOfflineQueue: () => {
    localStorage.removeItem('chat_offline_queue');
    set({ offlineQueue: [] });
  }
}));
