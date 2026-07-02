import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { getDb } from './database';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_chat_jwt_key_2026';

interface SocketUser {
  id: string;
  username: string;
}

// Keep track of active sockets mapped to user IDs
const userSockets = new Map<string, string[]>(); // userId -> socketIds[]

export function setupSocket(io: Server) {
  // Middleware to authenticate socket connections
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as SocketUser;
      socket.data.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Token invalid'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const user = socket.data.user as SocketUser;
    const userId = user.id;

    console.log(`User connected: ${user.username} (${userId})`);

    // Add socket to map
    const sockets = userSockets.get(userId) || [];
    sockets.push(socket.id);
    userSockets.set(userId, sockets);

    const db = await getDb();

    // 1. Update status to online in database
    await db.run('UPDATE users SET status = ?, last_seen = ? WHERE id = ?', ['online', Date.now(), userId]);

    // 2. Fetch all conversations this user belongs to, and join their rooms
    const conversations = await db.all(
      'SELECT conversation_id FROM conversation_members WHERE user_id = ?',
      [userId]
    );
    conversations.forEach((conv) => {
      socket.join(conv.conversation_id);
    });

    // 3. Broadcast status change to everyone
    io.emit('user_status', {
      userId,
      status: 'online',
      last_seen: Date.now()
    });

    // 4. Send the list of currently online user IDs to the connected client
    const onlineUsers = await db.all("SELECT id FROM users WHERE status = 'online'");
    socket.emit('online_users', onlineUsers.map((u) => u.id));

    // Handle incoming message
    socket.on('message_send', async (data: { id: string; conversationId: string; content: string; type?: string; created_at?: number }, callback) => {
      try {
        const { id, conversationId, content, type = 'text', created_at = Date.now() } = data;

        // Prevent duplicate insertions
        const existing = await db.get('SELECT id FROM messages WHERE id = ?', [id]);
        let savedMessage;
        
        if (!existing) {
          await db.run(
            'INSERT INTO messages (id, conversation_id, sender_id, content, type, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, conversationId, userId, content, type, 'sent', created_at]
          );
          
          savedMessage = {
            id,
            conversation_id: conversationId,
            sender_id: userId,
            content,
            type,
            status: 'sent',
            created_at
          };
        } else {
          savedMessage = await db.get('SELECT id, conversation_id, sender_id, content, type, status, created_at FROM messages WHERE id = ?', [id]);
        }

        // Broadcast to all conversation members (including the sender's other tabs)
        io.to(conversationId).emit('message_receive', savedMessage);

        if (callback) callback({ status: 'ok', message: savedMessage });
      } catch (err: any) {
        console.error('Error handling message_send:', err);
        if (callback) callback({ status: 'error', error: err.message });
      }
    });

    // Handle typing indicators
    socket.on('typing_start', (conversationId: string) => {
      socket.to(conversationId).emit('typing_start', {
        conversationId,
        userId,
        username: user.username
      });
    });

    socket.on('typing_stop', (conversationId: string) => {
      socket.to(conversationId).emit('typing_stop', {
        conversationId,
        userId
      });
    });

    // Handle read receipts
    socket.on('message_read', async (conversationId: string) => {
      try {
        await db.run(
          "UPDATE messages SET status = 'read' WHERE conversation_id = ? AND sender_id != ? AND status != 'read'",
          [conversationId, userId]
        );

        // Broadcast read receipt to room
        io.to(conversationId).emit('message_read_receipt', {
          conversationId,
          readBy: userId,
          timestamp: Date.now()
        });
      } catch (err) {
        console.error('Error handling message_read:', err);
      }
    });

    // Handle message deletion
    socket.on('message_delete', async (data: { messageId: string; conversationId: string }) => {
      try {
        const { messageId, conversationId } = data;
        await db.run(
          "UPDATE messages SET content = '🚫 This message was deleted', type = 'deleted', status = 'deleted' WHERE id = ?",
          [messageId]
        );
        io.to(conversationId).emit('message_delete_receipt', { messageId, conversationId });
      } catch (err) {
        console.error('Error deleting message:', err);
      }
    });

    // User joins a new conversation (e.g. newly created group/1-on-1 chat)
    socket.on('join_conversation', (conversationId: string) => {
      socket.join(conversationId);
      console.log(`Socket ${socket.id} joined new conversation: ${conversationId}`);
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id}`);
      
      // Remove socket from user's sockets list
      let sockets = userSockets.get(userId) || [];
      sockets = sockets.filter(id => id !== socket.id);
      
      if (sockets.length === 0) {
        userSockets.delete(userId);
        
        // No active socket connections remaining for this user, mark as offline
        const lastSeen = Date.now();
        await db.run('UPDATE users SET status = ?, last_seen = ? WHERE id = ?', ['offline', lastSeen, userId]);
        
        io.emit('user_status', {
          userId,
          status: 'offline',
          last_seen: lastSeen
        });
      } else {
        userSockets.set(userId, sockets);
      }
    });
  });
}
