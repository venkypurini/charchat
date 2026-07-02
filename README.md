# CharChat - Real-time Chat Application

A high-performance, real-time WhatsApp-style chat application with a stunning dark 3D glassmorphic UI built using a React (TypeScript + Vite) frontend and a Node.js (TypeScript + Express + Socket.io) backend.

## 🚀 1-Click Launch (Recommended for Windows)
You can start the entire application (both backend and frontend) and automatically open it directly in **Google Chrome** or **Microsoft Edge** with a single double-click:
- **Windows Batch Launcher**: Double-click `start-app.bat` (or simply `start-app`) in the project root folder.

## Tech Stack
- **Frontend**: React 18, Vite, TypeScript, Zustand (State Management), Tailwind CSS, Socket.io-client, Axios, Lucide Icons, Emoji-picker-react, React-virtuoso (Virtual Scrolling).
- **Backend**: Node.js, Express, TypeScript, Socket.io (Real-time events), SQLite (via `sqlite3` + `sqlite`), jsonwebtoken, bcryptjs.

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Installation

1. Clone or navigate to the project directory:
   ```bash
   cd "C:\Users\venky\.gemini\antigravity\scratch\realtime-chat-app"
   ```

2. Install dependencies for the backend:
   ```bash
   cd backend
   npm install
   ```

3. Install dependencies for the frontend:
   ```bash
   cd ../frontend
   npm install
   ```

---

## Running the Application

### 1. Start the Backend Server
Navigate to the `backend` folder and run:
```bash
npm run dev
```
The server will start on [http://localhost:5000](http://localhost:5000) and initialize a local `database.sqlite` file.

### 2. Start the Frontend Dev Server
Navigate to the `frontend` folder and run:
```bash
npm run dev
```
The dev server will boot up (typically on [http://localhost:5173](http://localhost:5173)). Open it in your web browser.

---

## API Specifications

All endpoints are prefixed with `/api` (e.g. `http://localhost:5000/api`).

### Authentication Endpoints

#### `POST /auth/register`
Creates a new user.
- **Request Body**:
  ```json
  {
    "username": "alice",
    "password": "supersecretpassword",
    "avatar_url": "https://url-to-avatar.png" (optional)
  }
  ```
- **Response**:
  ```json
  {
    "token": "eyJhbGciOi...",
    "user": {
      "id": "uuid-v4-string",
      "username": "alice",
      "avatar_url": "...",
      "status": "offline",
      "last_seen": 1719343200000
    }
  }
  ```

#### `POST /auth/login`
Authenticates a user.
- **Request Body**:
  ```json
  {
    "username": "alice",
    "password": "supersecretpassword"
  }
  ```
- **Response**:
  Same as register payload.

#### `GET /auth/me` (Protected)
Retrieves the logged-in user profile from the token.
- **Headers**: `Authorization: Bearer <JWT_TOKEN>`
- **Response**: User object.

---

### Conversations & Messages Endpoints

#### `GET /users` (Protected)
Search for users to start a chat.
- **Query Params**: `search` (optional)
- **Response**: Array of users.

#### `GET /conversations` (Protected)
Fetch all active conversations (1-on-1 and groups) the current user belongs to, decorated with members, last messages, and unread counts.
- **Response**: Array of conversations.

#### `POST /conversations` (Protected)
Create a new conversation.
- **Request Body**:
  ```json
  {
    "is_group": true,
    "name": "Project Alpha Team", (required if is_group is true)
    "user_ids": ["user-uuid-1", "user-uuid-2"]
  }
  ```
- **Response**: Newly created conversation object.

#### `GET /conversations/:id/messages` (Protected)
Fetch messages for a specific conversation with cursor-based pagination.
- **Query Params**:
  - `before`: Timestamp (fetch messages before this cursor, default: current time)
  - `limit`: Number of messages (default: 50)
- **Response**: Chronological array of messages.

---

## Socket.io Event Spec

Clients must initiate a socket connection authenticated via:
```javascript
const socket = io("http://localhost:5000", {
  auth: { token: "your-jwt-token" }
});
```

### Events Emitted by Client

- `message_send`: Dispatches a new message.
  ```json
  {
    "id": "msg-uuid-string",
    "conversationId": "conv-uuid-string",
    "content": "Hello world!",
    "type": "text",
    "created_at": 1719343200000
  }
  ```
- `typing_start`: Declares typing status in a room.
  - Parameter: `conversationId` (string)
- `typing_stop`: Stops typing status in a room.
  - Parameter: `conversationId` (string)
- `message_read`: Confirms a client has read messages in a conversation.
  - Parameter: `conversationId` (string)
- `join_conversation`: Joins the socket room for a newly created room.
  - Parameter: `conversationId` (string)

### Events Emitted by Server

- `user_status`: Dispatched to everyone when a user changes status.
  ```json
  {
    "userId": "user-uuid",
    "status": "online" | "offline",
    "last_seen": 1719343200000
  }
  ```
- `online_users`: Dispatched to client immediately on connection.
  - Parameter: `userIds` (array of online user IDs)
- `message_receive`: Dispatched to conversation room members when a message is sent.
  ```json
  {
    "id": "msg-uuid",
    "conversation_id": "conv-uuid",
    "sender_id": "sender-uuid",
    "content": "Hello world!",
    "type": "text",
    "status": "sent",
    "created_at": 1719343200000
  }
  ```
- `message_read_receipt`: Dispatched to room when a user reads messages.
  ```json
  {
    "conversationId": "conv-uuid",
    "readBy": "reader-user-uuid",
    "timestamp": 1719343200000
  }
  ```
- `typing_start`: Relays typing event to other room members.
  ```json
  {
    "conversationId": "conv-uuid",
    "userId": "typer-user-uuid",
    "username": "alice"
  }
  ```
- `typing_stop`: Relays typing stop event.
  ```json
  {
    "conversationId": "conv-uuid",
    "userId": "typer-user-uuid"
  }
  ```
