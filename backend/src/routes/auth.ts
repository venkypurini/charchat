import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';
import nodemailer from 'nodemailer';
import { getDb } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_chat_jwt_key_2026';

async function sendEmailOtp(email: string, otp: string): Promise<boolean> {
  // 1. Try Resend API (Free 3,000 emails/month, super popular)
  if (process.env.RESEND_API_KEY) {
    try {
      await axios.post('https://api.resend.com/emails', {
        from: process.env.EMAIL_FROM || 'CharChat <onboarding@resend.dev>',
        to: email,
        subject: `🔒 ${otp} is your CharChat verification code`,
        html: `<div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0f172a; color: #f8fafc; padding: 28px; border-radius: 16px; border: 1px solid #1e293b;"><h2 style="color: #2dd4bf; margin-top: 0;">CharChat Login Verification</h2><p style="color: #cbd5e1; font-size: 14px;">Here is your secure 6-digit verification code:</p><div style="font-size: 30px; font-weight: 800; letter-spacing: 6px; color: #2dd4bf; background: #1e293b; padding: 12px 24px; border-radius: 10px; display: inline-block; font-family: monospace; border: 1px solid #334155;">${otp}</div><p style="color: #64748b; font-size: 12px; margin-top: 20px;">Valid for exactly 5 minutes. Do not share this code with anyone.</p></div>`
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      console.log(`[REAL EMAIL] Sent Resend OTP ${otp} to ${email}`);
      return true;
    } catch (err: any) {
      console.error('Resend email error:', err?.response?.data || err.message);
    }
  }

  // 2. Try Nodemailer / SMTP / Gmail
  if (process.env.SMTP_USER || process.env.SMTP_HOST || process.env.GMAIL_USER) {
    try {
      let transporter;
      if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
          }
        });
      } else {
        transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || ''
          }
        });
      }

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || '"CharChat Security" <no-reply@charchat.com>',
        to: email,
        subject: `🔒 ${otp} is your CharChat verification code`,
        html: `<div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0f172a; color: #f8fafc; padding: 28px; border-radius: 16px; border: 1px solid #1e293b;"><h2 style="color: #2dd4bf; margin-top: 0;">CharChat Login Verification</h2><p style="color: #cbd5e1; font-size: 14px;">Here is your secure 6-digit verification code:</p><div style="font-size: 30px; font-weight: 800; letter-spacing: 6px; color: #2dd4bf; background: #1e293b; padding: 12px 24px; border-radius: 10px; display: inline-block; font-family: monospace; border: 1px solid #334155;">${otp}</div><p style="color: #64748b; font-size: 12px; margin-top: 20px;">Valid for exactly 5 minutes. Do not share this code with anyone.</p></div>`
      });
      console.log(`[REAL EMAIL] Sent SMTP OTP ${otp} to ${email}`);
      return true;
    } catch (err: any) {
      console.error('SMTP email error:', err?.message || err);
    }
  }

  return false;
}

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
    return res.status(400).json({ error: 'Username and mobile number / email are required' });
  }

  const isPhone = /^[0-9]{10}$/.test(mobile.trim());
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mobile.trim());

  if (!isPhone && !isEmail) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number or email address' });
  }

  try {
    const db = await getDb();

    // Check for username or mobile/email conflicts (Strict 1-to-1 rule)
    const userByUsername = await db.get('SELECT mobile, email FROM users WHERE username = ?', [username]);
    if (userByUsername && userByUsername.mobile !== mobile && userByUsername.email !== mobile) {
      return res.status(400).json({ error: `Username "${username}" is already linked to a different mobile/email. One user can only log in with their 1 attached mobile number and 1 attached email!` });
    }

    const userByIdentifier = await db.get('SELECT username FROM users WHERE mobile = ? OR email = ?', [mobile, mobile]);
    if (userByIdentifier && userByIdentifier.username !== username) {
      return res.status(400).json({ error: `This mobile/email is already linked to username "${userByIdentifier.username}". One mobile number can only be linked to 1 single account!` });
    }

    // Generate 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // Expires in 5 minutes

    // Store OTP in database
    await db.run(
      'INSERT OR REPLACE INTO otps (mobile, otp, expires_at) VALUES (?, ?, ?)',
      [mobile, otp, expiresAt]
    );

    let smsSent = false;
    let smsProvider = isEmail ? 'Mock Email Gateway' : 'Mock SMS Gateway (Free Mode)';

    // 0. If input is an Email Address, send Real Email OTP!
    if (isEmail) {
      const emailSent = await sendEmailOtp(mobile.trim(), otp);
      if (emailSent) {
        smsSent = true;
        smsProvider = 'Email Inbox';
      }
    }
    // 1. Try Fast2SMS (Popular & Affordable in India/Asia)
    if (process.env.FAST2SMS_API_KEY) {
      try {
        await axios.get('https://www.fast2sms.com/dev/bulkV2', {
          params: {
            authorization: process.env.FAST2SMS_API_KEY,
            variables_values: otp,
            route: 'otp',
            numbers: mobile
          }
        });
        smsSent = true;
        smsProvider = 'Fast2SMS';
        console.log(`[REAL SMS] Sent Fast2SMS OTP ${otp} to ${mobile}`);
      } catch (smsErr: any) {
        console.error('Fast2SMS error:', smsErr?.response?.data || smsErr.message);
      }
    }
    // 2. Try Twilio (Global SMS Standard)
    else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
      try {
        const twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        const formattedMobile = mobile.startsWith('+') ? mobile : (process.env.DEFAULT_COUNTRY_CODE || '+91') + mobile;
        await twilioClient.messages.create({
          body: `Your CharChat verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: formattedMobile
        });
        smsSent = true;
        smsProvider = 'Twilio';
        console.log(`[REAL SMS] Sent Twilio OTP ${otp} to ${formattedMobile}`);
      } catch (smsErr: any) {
        console.error('Twilio error:', smsErr?.message || smsErr);
      }
    }
    // 3. Try Green API (WhatsApp - 300 Free Messages/Month Forever)
    else if (process.env.GREEN_API_ID && process.env.GREEN_API_TOKEN) {
      try {
        const countryCode = process.env.DEFAULT_COUNTRY_CODE || '91';
        const cleanMobile = mobile.replace(/[^0-9]/g, '');
        const whatsappNumber = cleanMobile.length === 10 ? `${countryCode}${cleanMobile}` : cleanMobile;
        const apiUrl = `https://api.greenapi.com/waInstance${process.env.GREEN_API_ID}/sendMessage/${process.env.GREEN_API_TOKEN}`;
        await axios.post(apiUrl, {
          chatId: `${whatsappNumber}@c.us`,
          message: `🔒 Your CharChat verification code is: *${otp}*\n\nValid for 5 minutes. Do not share this code.`
        });
        smsSent = true;
        smsProvider = 'WhatsApp (Green API)';
        console.log(`[REAL WHATSAPP] Sent Green API OTP ${otp} to ${whatsappNumber}`);
      } catch (waErr: any) {
        console.error('Green API WhatsApp error:', waErr?.response?.data || waErr.message);
      }
    }
    // 4. Try UltraMsg (WhatsApp Gateway)
    else if (process.env.ULTRAMSG_INSTANCE_ID && process.env.ULTRAMSG_TOKEN) {
      try {
        const countryCode = process.env.DEFAULT_COUNTRY_CODE || '+91';
        const formattedMobile = mobile.startsWith('+') ? mobile : `${countryCode}${mobile}`;
        await axios.post(`https://api.ultramsg.com/${process.env.ULTRAMSG_INSTANCE_ID}/messages/chat`, {
          token: process.env.ULTRAMSG_TOKEN,
          to: formattedMobile,
          body: `🔒 Your CharChat verification code is: *${otp}*\n\nValid for 5 minutes. Do not share this code.`
        });
        smsSent = true;
        smsProvider = 'WhatsApp (UltraMsg)';
        console.log(`[REAL WHATSAPP] Sent UltraMsg OTP ${otp} to ${formattedMobile}`);
      } catch (waErr: any) {
        console.error('UltraMsg WhatsApp error:', waErr?.response?.data || waErr.message);
      }
    }

    if (!smsSent) {
      console.log(`[MOCK SMS] Sent OTP ${otp} to mobile ${mobile}`);
    }

    return res.json({ 
      success: true, 
      message: smsSent ? `Real SMS verification code sent via ${smsProvider}` : `Verification code sent to ${mobile}`, 
      otp,
      smsSent,
      smsProvider
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

    // Check if user exists (by mobile or email)
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mobile.trim());
    let user = await db.get('SELECT * FROM users WHERE mobile = ? OR email = ?', [mobile, mobile]);
    const timestamp = Date.now();

    if (!user) {
      const userId = crypto.randomUUID();
      const defaultColor = '#128C7E';
      const defaultAvatar = generateInitialsAvatar(username, defaultColor);

      await db.run(
        'INSERT INTO users (id, username, mobile, email, avatar_url, avatar_color, status, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, username, mobile, isEmail ? mobile : null, defaultAvatar, defaultColor, 'offline', timestamp]
      );

      user = {
        id: userId,
        username,
        mobile,
        email: isEmail ? mobile : null,
        avatar_url: defaultAvatar,
        avatar_color: defaultColor,
        status: 'offline',
        last_seen: timestamp
      };
    } else {
      if (isEmail && !user.email) {
        await db.run('UPDATE users SET email = ? WHERE id = ?', [mobile, user.id]);
        user.email = mobile;
      }
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

// Clear all history (call logs, saved contacts, and conversations) for current user
router.delete('/reset-history', authMiddleware, async (req: AuthRequest, res: Response) => {
  const currentUserId = req.user?.id;
  if (!currentUserId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const db = await getDb();
    await db.run('DELETE FROM call_logs WHERE caller_id = ? OR receiver_id = ?', [currentUserId, currentUserId]);
    await db.run('DELETE FROM saved_contacts WHERE user_id = ? OR contact_user_id = ?', [currentUserId, currentUserId]);
    await db.run('DELETE FROM conversation_members WHERE user_id = ?', [currentUserId]);
    await db.run('DELETE FROM messages WHERE sender_id = ?', [currentUserId]);
    return res.json({ success: true, message: 'All call logs, saved contacts, and chats cleared successfully.' });
  } catch (error) {
    console.error('Reset history error:', error);
    return res.status(500).json({ error: 'Failed to reset history' });
  }
});

export { generateInitialsAvatar };
export default router;
