import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDb } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_chat_jwt_key_2026';

// Helper to generate a initials avatar as a Data URI
function generateInitialsAvatar(username: string, bgColor?: string): string {
  const initials = username.slice(0, 2).toUpperCase();
  
  let color = bgColor;
  if (!color) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      '#128C7E', '#075E54', '#34B7F1', '#25D366', 
      '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B'
    ];
    color = colors[Math.abs(hash) % colors.length];
  }
  
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

// Request OTP code
router.post('/send-otp', async (req, res) => {
  const { username, mobile } = req.body;

  if (!username || !mobile) {
    return res.status(400).json({ error: 'Username and 10-digit mobile number are required' });
  }

  const mobileRegex = /^[0-9]{10}$/;
  if (!mobileRegex.test(mobile)) {
    return res.status(400).json({ error: 'Mobile number must be exactly 10 digits' });
  }

  try {
    const db = await getDb();

    // Check for username or mobile conflicts
    const userByUsername = await db.get('SELECT mobile FROM users WHERE username = ?', [username]);
    if (userByUsername && userByUsername.mobile !== mobile) {
      return res.status(400).json({ error: 'Username is already registered with a different mobile number' });
    }

    const userByMobile = await db.get('SELECT username FROM users WHERE mobile = ?', [mobile]);
    if (userByMobile && userByMobile.username !== username) {
      return res.status(400).json({ error: 'Mobile number is already registered with a different username' });
    }

    // Generate 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // Expires in 5 minutes

    // Store OTP in database
    await db.run(
      'INSERT OR REPLACE INTO otps (mobile, otp, expires_at) VALUES (?, ?, ?)',
      [mobile, otp, expiresAt]
    );

    console.log(`[MOCK SMS] Sent OTP ${otp} to mobile ${mobile}`);

    return res.json({ 
      success: true, 
      message: `Mock OTP sent to ${mobile}`, 
      otp
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    return res.status(500).json({ error: 'Failed to send OTP code' });
  }
});

// Verify OTP & Register/Login
router.post('/verify-otp', async (req, res) => {
  const { username, mobile, otp } = req.body;

  if (!username || !mobile || !otp) {
    return res.status(400).json({ error: 'Username, mobile, and OTP code are required' });
  }

  try {
    const db = await getDb();

    const otpData = await db.get('SELECT * FROM otps WHERE mobile = ?', [mobile]);

    if (!otpData) {
      return res.status(400).json({ error: 'No OTP requested for this mobile number' });
    }

    if (otpData.otp !== otp) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    if (otpData.expires_at < Date.now()) {
      return res.status(400).json({ error: 'Verification code has expired' });
    }

    // OTP is valid
    await db.run('DELETE FROM otps WHERE mobile = ?', [mobile]);

    // Check if user exists
    let user = await db.get('SELECT * FROM users WHERE mobile = ?', [mobile]);
    const timestamp = Date.now();

    if (!user) {
      const userId = crypto.randomUUID();
      const defaultColor = '#128C7E';
      const defaultAvatar = generateInitialsAvatar(username, defaultColor);

      await db.run(
        'INSERT INTO users (id, username, mobile, avatar_url, avatar_color, status, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, username, mobile, defaultAvatar, defaultColor, 'offline', timestamp]
      );

      user = {
        id: userId,
        username,
        mobile,
        avatar_url: defaultAvatar,
        avatar_color: defaultColor,
        status: 'offline',
        last_seen: timestamp
      };
    }

    // Sign JWT token
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        mobile: user.mobile,
        avatar_url: user.avatar_url,
        avatar_color: user.avatar_color || '#128C7E',
        status: user.status,
        last_seen: user.last_seen
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({ error: 'Failed to verify OTP code' });
  }
});

// Update Profile settings
router.post('/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
  const currentUserId = req.user?.id;
  const { username, avatarColor, avatarUrl, removeAvatar } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const db = await getDb();

    // Check if username is already taken by someone else
    const existingUser = await db.get('SELECT id FROM users WHERE username = ? AND id != ?', [username, currentUserId]);
    if (existingUser) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const currentUserData = await db.get('SELECT avatar_color, avatar_url FROM users WHERE id = ?', [currentUserId]);
    const colorToSave = avatarColor || currentUserData?.avatar_color || '#128C7E';

    let finalAvatarUrl = avatarUrl;
    if (removeAvatar) {
      finalAvatarUrl = generateInitialsAvatar(username, colorToSave);
    } else if (!finalAvatarUrl) {
      const currentAvatar = currentUserData?.avatar_url || '';
      if (!currentAvatar || currentAvatar.startsWith('data:image/svg+xml')) {
        let match = decodeURIComponent(currentAvatar).match(/fill="([^"]+)"/);
        let bgColor = avatarColor || (match ? match[1] : undefined) || colorToSave;
        finalAvatarUrl = generateInitialsAvatar(username, bgColor);
      } else {
        finalAvatarUrl = currentAvatar;
      }
    }

    if (finalAvatarUrl) {
      await db.run(
        'UPDATE users SET username = ?, avatar_url = ?, avatar_color = ? WHERE id = ?',
        [username, finalAvatarUrl, colorToSave, currentUserId]
      );
    } else {
      await db.run(
        'UPDATE users SET username = ?, avatar_color = ? WHERE id = ?',
        [username, colorToSave, currentUserId]
      );
    }

    const updatedUser = await db.get('SELECT id, username, mobile, avatar_url, avatar_color, status, last_seen FROM users WHERE id = ?', [currentUserId]);
    const token = jwt.sign({ id: updatedUser.id, username: updatedUser.username }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      token,
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get Current User Profile
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const user = await db.get('SELECT id, username, mobile, avatar_url, avatar_color, status, last_seen FROM users WHERE id = ?', [req.user?.id]);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (error: any) {
    console.error('Fetch me error:', error);
    return res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

export { generateInitialsAvatar };
export default router;
