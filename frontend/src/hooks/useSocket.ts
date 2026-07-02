import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useChatStore } from '../store/store';

let socket: Socket | null = null;

export const getSocket = () => socket;

export function useSocket() {
  const token = useChatStore((state) => state.token);
  const user = useChatStore((state) => state.user);
  const setSocketConnected = useChatStore((state) => state.setSocketConnected);
  const setOnlineUsers = useChatStore((state) => state.setOnlineUsers);
  const updateUserPresence = useChatStore((state) => state.updateUserPresence);
  const addMessage = useChatStore((state) => state.addMessage);
  const deleteMessage = useChatStore((state) => state.deleteMessage);
  const markMessagesAsRead = useChatStore((state) => state.markMessagesAsRead);
  const setTypingStatus = useChatStore((state) => state.setTypingStatus);
  const dequeueOfflineMessage = useChatStore((state) => state.dequeueOfflineMessage);

  useEffect(() => {
    if (!token || !user) {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      return;
    }

    if (!socket) {
      const socketUrl = import.meta.env.VITE_SOCKET_URL || (import.meta.env.PROD ? window.location.origin : 'http://localhost:5000');
      socket = io(socketUrl, {
        auth: { token },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      socket.on('connect', () => {
        console.log('Socket connected!');
        setSocketConnected(true);

        // Flush offline messages queue upon connection/reconnection
        const queueCopy = [...useChatStore.getState().offlineQueue];
        if (queueCopy.length > 0) {
          console.log(`Flushing ${queueCopy.length} offline messages...`);
          queueCopy.forEach((msg) => {
            socket?.emit('message_send', {
              id: msg.id,
              conversationId: msg.conversation_id,
              content: msg.content,
              type: msg.type,
              created_at: msg.created_at
            }, (response: any) => {
              if (response && response.status === 'ok') {
                dequeueOfflineMessage(msg.id);
              }
            });
          });
        }
      });

      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setSocketConnected(false);
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setSocketConnected(false);
      });

      socket.on('online_users', (userIds: string[]) => {
        setOnlineUsers(userIds);
      });

      socket.on('user_status', (data: { userId: string; status: string; last_seen: number }) => {
        updateUserPresence(data.userId, data.status, data.last_seen);
      });

      socket.on('message_receive', (message: any) => {
        addMessage(message.conversation_id, message);

        // Send read receipt if active conversation matches and message is not from self
        const state = useChatStore.getState();
        if (state.activeConversationId === message.conversation_id && message.sender_id !== state.user?.id) {
          socket?.emit('message_read', message.conversation_id);
        }
      });

      socket.on('message_read_receipt', (data: { conversationId: string; readBy: string; timestamp: number }) => {
        markMessagesAsRead(data.conversationId, data.readBy);
      });

      socket.on('message_delete_receipt', (data: { messageId: string; conversationId: string }) => {
        deleteMessage(data.conversationId, data.messageId);
      });

      socket.on('typing_start', (data: { conversationId: string; userId: string; username: string }) => {
        setTypingStatus(data.conversationId, data.userId, data.username, true);
      });

      socket.on('typing_stop', (data: { conversationId: string; userId: string }) => {
        setTypingStatus(data.conversationId, data.userId, '', false);
      });
    }

    return () => {
      // Keep persistent connection unless logging out (which clears token/user and triggers hook restart)
    };
  }, [token, user]);

  return socket;
}
