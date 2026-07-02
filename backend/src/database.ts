import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

let db: Database;

export async function getDb(): Promise<Database> {
  if (db) return db;
  
  const dbFile = process.env.DB_FILE || './database.sqlite';
  const dbPath = path.isAbsolute(dbFile) ? dbFile : path.resolve(process.cwd(), dbFile);

  // If call_logs table doesn't exist, we can let it auto-create.
  // To avoid deleting chat databases repeatedly, we will keep the DB reset safe,
  // but since we are modifying schemas, we ensure it drops and recreates if needed, 
  // or simply run CREATE TABLE IF NOT EXISTS.
  
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await db.run('PRAGMA foreign_keys = ON;');

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      mobile TEXT UNIQUE NOT NULL,
      avatar_url TEXT,
      avatar_color TEXT DEFAULT '#128C7E',
      status TEXT DEFAULT 'offline',
      last_seen INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      name TEXT, -- NULL for 1-to-1 chats
      is_group INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversation_members (
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      joined_at INTEGER NOT NULL,
      PRIMARY KEY (conversation_id, user_id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'read'
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS otps (
      mobile TEXT PRIMARY KEY,
      otp TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS call_logs (
      id TEXT PRIMARY KEY,
      caller_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      type TEXT NOT NULL, -- 'voice' or 'video'
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (caller_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS saved_contacts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      contact_user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (contact_user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, contact_user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_call_logs_caller ON call_logs(caller_id);
    CREATE INDEX IF NOT EXISTS idx_call_logs_receiver ON call_logs(receiver_id);
    CREATE INDEX IF NOT EXISTS idx_saved_contacts_user ON saved_contacts(user_id);
  `);

  await db.exec("ALTER TABLE users ADD COLUMN avatar_color TEXT DEFAULT '#128C7E';").catch(() => {});

  return db;
}
