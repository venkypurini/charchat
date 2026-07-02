import { getSocket } from './useSocket';
import { useChatStore, Message, OfflineMessage } from '../store/store';
import api from '../api';

export function useChat() {
  const socketConnected = useChatStore((state) => state.socketConnected);
  const user = useChatStore((state) => state.user);
  const addMessage = useChatStore((state) => state.addMessage);
  const enqueueOfflineMessage = useChatStore((state) => state.enqueueOfflineMessage);

  const sendMessage = async (conversationId: string, content: string, type: string = 'text', extra?: { mood?: string; unlock_at?: number; interactive_type?: string; interactive_data?: string }) => {
    if (!user) return;

    const messageId = crypto.randomUUID();
    const timestamp = Date.now();

    const localMessage: Message = {
      id: messageId,
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      type,
      status: 'sent',
      mood: extra?.mood || null,
      unlock_at: extra?.unlock_at || null,
      interactive_type: extra?.interactive_type || null,
      interactive_data: extra?.interactive_data || null,
      created_at: timestamp,
      isPending: !socketConnected
    };

    addMessage(conversationId, localMessage);

    const socket = getSocket();

    if (socketConnected && socket) {
      socket.emit('message_send', {
        id: messageId,
        conversationId,
        content,
        type,
        mood: extra?.mood || null,
        unlock_at: extra?.unlock_at || null,
        interactive_type: extra?.interactive_type || null,
        interactive_data: extra?.interactive_data || null,
        created_at: timestamp
      });
    } else {
      const offlineMsg: OfflineMessage = {
        id: messageId,
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        type,
        mood: extra?.mood || null,
        unlock_at: extra?.unlock_at || null,
        interactive_type: extra?.interactive_type || null,
        interactive_data: extra?.interactive_data || null,
        created_at: timestamp
      };
      enqueueOfflineMessage(offlineMsg);
    }
  };

  const sendTypingStart = (conversationId: string) => {
    const socket = getSocket();
    if (socketConnected && socket) {
      socket.emit('typing_start', conversationId);
    }
  };

  const sendTypingStop = (conversationId: string) => {
    const socket = getSocket();
    if (socketConnected && socket) {
      socket.emit('typing_stop', conversationId);
    }
  };

  const sendReadReceipt = (conversationId: string) => {
    const socket = getSocket();
    if (socketConnected && socket) {
      socket.emit('message_read', conversationId);
    }
  };

  const loadConversations = async () => {
    try {
      const response = await api.get('/conversations');
      useChatStore.getState().setConversations(response.data);
      
      const socket = getSocket();
      if (socket) {
        response.data.forEach((conv: any) => {
          socket.emit('join_conversation', conv.id);
        });
      }
      return response.data;
    } catch (error) {
      console.error('Failed to load conversations:', error);
      throw error;
    }
  };

  const loadMessages = async (conversationId: string, before?: number) => {
    try {
      const url = `/conversations/${conversationId}/messages` + (before ? `?before=${before}` : '');
      const response = await api.get(url);
      
      const currentMessages = useChatStore.getState().messages[conversationId] || [];
      
      const messageMap = new Map<string, Message>();
      currentMessages.forEach(m => messageMap.set(m.id, m));
      response.data.forEach((m: Message) => messageMap.set(m.id, m));
      
      const mergedMessages = Array.from(messageMap.values()).sort((a, b) => a.created_at - b.created_at);
      
      useChatStore.getState().setMessages(conversationId, mergedMessages);
      return response.data;
    } catch (error) {
      console.error(`Failed to load messages for conversation ${conversationId}:`, error);
      throw error;
    }
  };

  const createConversation = async (userIds: string[], isGroup: boolean, name?: string) => {
    try {
      const response = await api.post('/conversations', {
        user_ids: userIds,
        is_group: isGroup,
        name: isGroup ? name : null
      });

      const newConversation = response.data;
      useChatStore.getState().addConversation(newConversation);

      const socket = getSocket();
      if (socket) {
        socket.emit('join_conversation', newConversation.id);
      }

      return newConversation;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    }
  };

  const createConversationByMobile = async (username: string, mobile: string) => {
    try {
      const response = await api.post('/conversations/by-mobile', { username, mobile });
      const newConversation = response.data;
      useChatStore.getState().addConversation(newConversation);

      const socket = getSocket();
      if (socket) {
        socket.emit('join_conversation', newConversation.id);
      }

      return newConversation;
    } catch (error) {
      console.error('Failed to create conversation by mobile:', error);
      throw error;
    }
  };

  return {
    sendMessage,
    sendTypingStart,
    sendTypingStop,
    sendReadReceipt,
    loadConversations,
    loadMessages,
    createConversation,
    createConversationByMobile
  };
}
