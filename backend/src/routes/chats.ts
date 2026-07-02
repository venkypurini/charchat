import { Router, Response } from 'express';
import crypto from 'crypto';
import { getDb } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { generateInitialsAvatar } from './auth';

const router = Router();

// Get list of users (to start a new chat with)
router.get('/users', authMiddleware, async (req: AuthRequest, res: Response) => {
  const search = req.query.search as string;
  const currentUserId = req.user?.id;

  try {
    const db = await getDb();
    let users;
    if (search) {
      users = await db.all(
        'SELECT id, username, mobile, avatar_url, avatar_color, status, last_seen FROM users WHERE id != ? AND (username LIKE ? OR mobile LIKE ?) LIMIT 20',
        [currentUserId, `%${search}%`, `%${search}%`]
      );
    } else {
      users = await db.all(
        'SELECT id, username, mobile, avatar_url, avatar_color, status, last_seen FROM users WHERE id != ? LIMIT 20',
        [currentUserId]
      );
    }
    return res.json(users);
  } catch (error) {
    console.error('Search users error:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Fetch active conversations list for current user
router.get('/conversations', authMiddleware, async (req: AuthRequest, res: Response) => {
  const currentUserId = req.user?.id;

  try {
    const db = await getDb();
    const userConversations = await db.all(
      `SELECT c.id, c.name, c.is_group, c.created_at 
       FROM conversations c
       JOIN conversation_members cm ON c.id = cm.conversation_id
       WHERE cm.user_id = ?`,
      [currentUserId]
    );

    const detailedConversations = await Promise.all(
      userConversations.map(async (conv) => {
        const members = await db.all(
          `SELECT u.id, u.username, u.mobile, u.avatar_url, u.avatar_color, u.status, u.last_seen 
           FROM users u
           JOIN conversation_members cm ON u.id = cm.user_id
           WHERE cm.conversation_id = ?`,
          [conv.id]
        );

        const lastMessage = await db.get(
          `SELECT id, content, sender_id, type, status, mood, unlock_at, interactive_type, interactive_data, created_at 
           FROM messages 
           WHERE conversation_id = ? 
           ORDER BY created_at DESC LIMIT 1`,
          [conv.id]
        );

        const unreadData = await db.get(
          `SELECT COUNT(*) as count 
           FROM messages 
           WHERE conversation_id = ? AND sender_id != ? AND status != 'read'`,
          [conv.id, currentUserId]
        );

        return {
          id: conv.id,
          name: conv.name,
          is_group: conv.is_group === 1,
          created_at: conv.created_at,
          members,
          last_message: lastMessage || null,
          unread_count: unreadData?.count || 0
        };
      })
    );

    detailedConversations.sort((a, b) => {
      const timeA = a.last_message ? a.last_message.created_at : a.created_at;
      const timeB = b.last_message ? b.last_message.created_at : b.created_at;
      return timeB - timeA;
    });

    return res.json(detailedConversations);
  } catch (error) {
    console.error('Fetch conversations error:', error);
    return res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Fetch messages for a specific conversation (with cursor pagination)
router.get('/conversations/:id/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  const conversationId = req.params.id;
  const currentUserId = req.user?.id;
  const before = req.query.before ? parseInt(req.query.before as string) : Date.now();
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

  try {
    const db = await getDb();
    
    const isMember = await db.get(
      'SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
      [conversationId, currentUserId]
    );

    if (!isMember) {
      return res.status(403).json({ error: 'You are not a member of this conversation' });
    }

    const messages = await db.all(
      `SELECT id, conversation_id, sender_id, content, type, status, mood, unlock_at, interactive_type, interactive_data, created_at 
       FROM messages 
       WHERE conversation_id = ? AND created_at < ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [conversationId, before, limit]
    );

    return res.json(messages.reverse());
  } catch (error) {
    console.error('Fetch messages error:', error);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Create/Open a conversation by participant user_ids
router.post('/conversations', authMiddleware, async (req: AuthRequest, res: Response) => {
  const currentUserId = req.user?.id;
  const { is_group, name, user_ids } = req.body;

  if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
    return res.status(400).json({ error: 'Participants list is required' });
  }

  const allParticipantIds = Array.from(new Set([currentUserId, ...user_ids]));

  try {
    const db = await getDb();

    if (!is_group && allParticipantIds.length === 2) {
      const otherUserId = allParticipantIds.find(id => id !== currentUserId);
      const existingConv = await db.get(
        `SELECT c.id as conversation_id 
         FROM conversations c
         WHERE c.is_group = 0 
         AND (SELECT COUNT(*) FROM conversation_members cm WHERE cm.conversation_id = c.id AND cm.user_id IN (?, ?)) > 0
         AND (SELECT COUNT(*) FROM conversation_members cm WHERE cm.conversation_id = c.id AND cm.user_id NOT IN (?, ?)) = 0
         LIMIT 1`,
        [currentUserId, otherUserId, currentUserId, otherUserId]
      );

      if (existingConv) {
        await db.run(
          'INSERT OR IGNORE INTO conversation_members (conversation_id, user_id, joined_at) VALUES (?, ?, ?)',
          [existingConv.conversation_id, currentUserId, Date.now()]
        );
        const members = await db.all(
          `SELECT u.id, u.username, u.mobile, u.avatar_url, u.status, u.last_seen 
           FROM users u
           JOIN conversation_members cm ON u.id = cm.user_id
           WHERE cm.conversation_id = ?`,
          [existingConv.conversation_id]
        );

        const lastMessage = await db.get(
          `SELECT id, content, sender_id, type, status, mood, unlock_at, interactive_type, interactive_data, created_at 
           FROM messages 
           WHERE conversation_id = ? 
           ORDER BY created_at DESC LIMIT 1`,
          [existingConv.conversation_id]
        );

        return res.json({
          id: existingConv.conversation_id,
          name: null,
          is_group: false,
          created_at: Date.now(),
          members,
          last_message: lastMessage || null,
          unread_count: 0
        });
      }
    }

    const conversationId = crypto.randomUUID();
    const timestamp = Date.now();
    const isGroupInt = is_group ? 1 : 0;
    const conversationName = is_group ? (name || 'Group Chat') : null;

    await db.run('BEGIN TRANSACTION');

    await db.run(
      'INSERT INTO conversations (id, name, is_group, created_at) VALUES (?, ?, ?, ?)',
      [conversationId, conversationName, isGroupInt, timestamp]
    );

    for (const userId of allParticipantIds) {
      await db.run(
        'INSERT INTO conversation_members (conversation_id, user_id, joined_at) VALUES (?, ?, ?)',
        [conversationId, userId, timestamp]
      );
    }

    await db.run('COMMIT');

    const members = await db.all(
      `SELECT u.id, u.username, u.mobile, u.avatar_url, u.status, u.last_seen 
       FROM users u
       JOIN conversation_members cm ON u.id = cm.user_id
       WHERE cm.conversation_id = ?`,
      [conversationId]
    );

    return res.status(201).json({
      id: conversationId,
      name: conversationName,
      is_group: is_group,
      created_at: timestamp,
      members,
      last_message: null,
      unread_count: 0
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    try {
      const db = await getDb();
      await db.run('ROLLBACK');
    } catch (_) {}
    return res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Create/Open a conversation by username & mobile contact number
router.post('/conversations/by-mobile', authMiddleware, async (req: AuthRequest, res: Response) => {
  const currentUserId = req.user?.id;
  const { username, mobile } = req.body;

  if (!mobile) {
    return res.status(400).json({ error: 'Mobile number is required' });
  }

  const mobileRegex = /^[0-9]{10}$/;
  if (!mobileRegex.test(mobile)) {
    return res.status(400).json({ error: 'Mobile number must be exactly 10 digits' });
  }

  try {
    const db = await getDb();

    // 1. Check if user already exists with this mobile
    let targetUser = await db.get('SELECT * FROM users WHERE mobile = ?', [mobile]);

    if (!targetUser) {
      let resolvedName = (username && username.trim()) ? username.trim() : `Contact ${mobile}`;

      // Check if username is already taken by someone else
      const usernameExists = await db.get('SELECT id FROM users WHERE username = ? AND id != ?', [resolvedName, currentUserId]);
      if (usernameExists) {
        resolvedName = `${resolvedName} (${mobile.slice(-4)})`;
      }

      // Create stub user in database
      const targetUserId = crypto.randomUUID();
      const defaultAvatar = generateInitialsAvatar(resolvedName);
      const timestamp = Date.now();

      await db.run(
        'INSERT INTO users (id, username, mobile, avatar_url, status, last_seen) VALUES (?, ?, ?, ?, ?, ?)',
        [targetUserId, resolvedName, mobile, defaultAvatar, 'offline', timestamp]
      );

      targetUser = {
        id: targetUserId,
        username: resolvedName,
        mobile,
        avatar_url: defaultAvatar,
        status: 'offline',
        last_seen: timestamp
      };
    }

    // Prevent starting a chat with oneself
    if (targetUser.id === currentUserId) {
      return res.status(400).json({ error: 'You cannot add yourself as a contact' });
    }

    // 2. Check if a 1-to-1 conversation already exists
    const existingConv = await db.get(
      `SELECT c.id as conversation_id 
       FROM conversations c
       WHERE c.is_group = 0 
       AND (SELECT COUNT(*) FROM conversation_members cm WHERE cm.conversation_id = c.id AND cm.user_id IN (?, ?)) > 0
       AND (SELECT COUNT(*) FROM conversation_members cm WHERE cm.conversation_id = c.id AND cm.user_id NOT IN (?, ?)) = 0
       LIMIT 1`,
      [currentUserId, targetUser.id, currentUserId, targetUser.id]
    );

    let conversationId;

    if (existingConv) {
      conversationId = existingConv.conversation_id;
      await db.run(
        'INSERT OR IGNORE INTO conversation_members (conversation_id, user_id, joined_at) VALUES (?, ?, ?)',
        [conversationId, currentUserId, Date.now()]
      );
    } else {
      // Create new conversation
      conversationId = crypto.randomUUID();
      const timestamp = Date.now();

      await db.run('BEGIN TRANSACTION');
      try {
        await db.run(
          'INSERT INTO conversations (id, name, is_group, created_at) VALUES (?, ?, ?, ?)',
          [conversationId, null, 0, timestamp]
        );

        await db.run(
          'INSERT INTO conversation_members (conversation_id, user_id, joined_at) VALUES (?, ?, ?)',
          [conversationId, currentUserId, timestamp]
        );

        await db.run(
          'INSERT INTO conversation_members (conversation_id, user_id, joined_at) VALUES (?, ?, ?)',
          [conversationId, targetUser.id, timestamp]
        );

        await db.run('COMMIT');
      } catch (err) {
        await db.run('ROLLBACK');
        throw err;
      }
    }

    // Save contact in saved_contacts table
    await db.run(
      'INSERT OR REPLACE INTO saved_contacts (id, user_id, contact_user_id, name, mobile, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), currentUserId, targetUser.id, targetUser.username, targetUser.mobile, Date.now()]
    );

    const members = await db.all(
      `SELECT u.id, u.username, u.mobile, u.avatar_url, u.status, u.last_seen 
       FROM users u
       JOIN conversation_members cm ON u.id = cm.user_id
       WHERE cm.conversation_id = ?`,
      [conversationId]
    );

    const lastMessage = await db.get(
      `SELECT id, content, sender_id, type, status, mood, unlock_at, interactive_type, interactive_data, created_at 
       FROM messages 
       WHERE conversation_id = ? 
       ORDER BY created_at DESC LIMIT 1`,
      [conversationId]
    );

    return res.status(201).json({
      id: conversationId,
      name: null,
      is_group: false,
      created_at: Date.now(),
      members,
      last_message: lastMessage || null,
      unread_count: 0
    });
  } catch (error) {
    console.error('Create conversation by mobile error:', error);
    return res.status(500).json({ error: 'Failed to create conversation by contact number' });
  }
});

// Fetch Call Logs for current user
router.get('/calls', authMiddleware, async (req: AuthRequest, res: Response) => {
  const currentUserId = req.user?.id;

  try {
    const db = await getDb();
    const calls = await db.all(
      `SELECT 
        cl.id,
        cl.caller_id,
        cl.receiver_id,
        cl.type,
        cl.timestamp,
        u_other.id AS other_user_id,
        u_other.username AS other_username,
        u_other.avatar_url AS other_avatar_url
      FROM call_logs cl
      JOIN users u_other ON (
        (cl.caller_id = ? AND cl.receiver_id = u_other.id) OR
        (cl.receiver_id = ? AND cl.caller_id = u_other.id)
      )
      WHERE cl.caller_id = ? OR cl.receiver_id = ?
      ORDER BY cl.timestamp DESC`,
      [currentUserId, currentUserId, currentUserId, currentUserId]
    );

    const formattedCalls = calls.map(c => ({
      id: c.id,
      type: c.type,
      timestamp: c.timestamp,
      isOutgoing: c.caller_id === currentUserId,
      peer: {
        id: c.other_user_id,
        username: c.other_username,
        avatar_url: c.other_avatar_url
      }
    }));

    return res.json(formattedCalls);
  } catch (error) {
    console.error('Fetch calls error:', error);
    return res.status(500).json({ error: 'Failed to fetch call logs' });
  }
});

// Create/Log a Call
router.post('/calls', authMiddleware, async (req: AuthRequest, res: Response) => {
  const currentUserId = req.user?.id;
  const { receiver_id, type } = req.body; // type: 'voice' | 'video'

  if (!receiver_id || !type) {
    return res.status(400).json({ error: 'Receiver ID and call type are required' });
  }

  try {
    const db = await getDb();
    const callId = crypto.randomUUID();
    const timestamp = Date.now();

    await db.run(
      'INSERT INTO call_logs (id, caller_id, receiver_id, type, timestamp) VALUES (?, ?, ?, ?, ?)',
      [callId, currentUserId, receiver_id, type, timestamp]
    );

    const peer = await db.get('SELECT id, username, avatar_url FROM users WHERE id = ?', [receiver_id]);

    return res.status(201).json({
      id: callId,
      type,
      timestamp,
      isOutgoing: true,
      peer: {
        id: peer?.id,
        username: peer?.username,
        avatar_url: peer?.avatar_url
      }
    });
  } catch (error) {
    console.error('Log call error:', error);
    return res.status(500).json({ error: 'Failed to log call' });
  }
});

// Get all saved contacts for current user
router.get('/contacts', authMiddleware, async (req: AuthRequest, res: Response) => {
  const currentUserId = req.user?.id;
  try {
    const db = await getDb();
    const contacts = await db.all(
      `SELECT sc.id as saved_contact_id, sc.name as custom_name, sc.mobile, sc.contact_user_id as id, u.username, u.avatar_url, u.status, u.last_seen
       FROM saved_contacts sc
       JOIN users u ON sc.contact_user_id = u.id
       WHERE sc.user_id = ?
       ORDER BY sc.name ASC`,
      [currentUserId]
    );
    return res.json(contacts);
  } catch (error) {
    console.error('Fetch contacts error:', error);
    return res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// Delete a saved contact
router.delete('/contacts/:contactUserId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const currentUserId = req.user?.id;
  const { contactUserId } = req.params;
  try {
    const db = await getDb();
    await db.run(
      'DELETE FROM saved_contacts WHERE user_id = ? AND (contact_user_id = ? OR id = ?)',
      [currentUserId, contactUserId, contactUserId]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Delete contact error:', error);
    return res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// Delete active conversation from user's chat list
router.delete('/conversations/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const currentUserId = req.user?.id;
  const { id } = req.params;
  try {
    const db = await getDb();
    await db.run('DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?', [id, currentUserId]);
    return res.json({ success: true });
  } catch (error) {
    console.error('Delete conversation error:', error);
    return res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// AI Memory Chat search endpoint
router.post('/ai/memory', authMiddleware, async (req: AuthRequest, res: Response) => {
  const currentUserId = req.user?.id;
  const { query, conversationId } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const db = await getDb();
    
    // Check membership if conversationId is specified
    let targetConversations: string[] = [];
    if (conversationId) {
      const isMember = await db.get('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?', [conversationId, currentUserId]);
      if (!isMember) return res.status(403).json({ error: 'Not authorized for this conversation' });
      targetConversations.push(conversationId);
    } else {
      const convs = await db.all('SELECT conversation_id FROM conversation_members WHERE user_id = ?', [currentUserId]);
      targetConversations = convs.map(c => c.conversation_id);
    }

    if (targetConversations.length === 0) {
      return res.json({ answer: "You have no active conversations yet to search in.", messages: [] });
    }

    // Parse query for keywords and types
    const lowerQuery = query.toLowerCase();
    const stopWords = ['what', 'when', 'did', 'who', 'how', 'where', 'show', 'all', 'the', 'is', 'about', 'in', 'on', 'at', 'to', 'for', 'a', 'an', 'send', 'sent', 'discuss', 'discussions', 'promise', 'promises'];
    const words = lowerQuery.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));

    let typeFilter = null;
    if (lowerQuery.includes('photo') || lowerQuery.includes('image') || lowerQuery.includes('picture')) typeFilter = 'image';
    if (lowerQuery.includes('voice') || lowerQuery.includes('audio') || lowerQuery.includes('recording')) typeFilter = 'audio';
    if (lowerQuery.includes('file') || lowerQuery.includes('pdf') || lowerQuery.includes('doc')) typeFilter = 'file';

    const placeholders = targetConversations.map(() => '?').join(',');
    let sql = `SELECT m.*, u.username as sender_name 
               FROM messages m 
               JOIN users u ON m.sender_id = u.id 
               WHERE m.conversation_id IN (${placeholders})`;
    const params: any[] = [...targetConversations];

    if (typeFilter) {
      sql += ` AND m.type = ?`;
      params.push(typeFilter);
    } else if (words.length > 0) {
      const keywordConditions = words.map(() => `m.content LIKE ?`).join(' OR ');
      sql += ` AND (${keywordConditions})`;
      words.forEach(w => params.push(`%${w}%`));
    }

    sql += ` ORDER BY m.created_at DESC LIMIT 20`;
    const matchedMessages = await db.all(sql, params);

    // Synthesize an AI summary answer
    let answer = "";
    if (matchedMessages.length === 0) {
      answer = `I scanned your conversation memory for "${query}", but couldn't find any direct matches or discussions.`;
    } else {
      const count = matchedMessages.length;
      const latest = matchedMessages[0];
      const dateStr = new Date(latest.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      
      if (lowerQuery.includes('when')) {
        answer = `I found ${count} relevant record${count > 1 ? 's' : ''}. The most recent was by **${latest.sender_name}** on **${dateStr}**: "${latest.content}"`;
      } else if (lowerQuery.includes('promise') || lowerQuery.includes('agree')) {
        answer = `Scanning for commitments and promises: Found ${count} discussion item${count > 1 ? 's' : ''}. For example, **${latest.sender_name}** mentioned: "${latest.content}" on ${dateStr}.`;
      } else if (typeFilter) {
        answer = `I located ${count} ${typeFilter} message${count > 1 ? 's' : ''} shared in your chat memory. Click below to view or jump to them!`;
      } else {
        answer = `AI Memory found ${count} relevant discussion${count > 1 ? 's' : ''} matching your inquiry. Highlights include **${latest.sender_name}** saying: "${latest.content}" on ${dateStr}.`;
      }
    }

    return res.json({ answer, messages: matchedMessages });
  } catch (error) {
    console.error('AI memory error:', error);
    return res.status(500).json({ error: 'AI Memory processing failed' });
  }
});

export default router;
