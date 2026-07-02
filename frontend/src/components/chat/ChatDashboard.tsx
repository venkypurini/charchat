import React from 'react';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import { useSocket } from '../../hooks/useSocket';
import { useChatStore } from '../../store/store';

export default function ChatDashboard() {
  // Activate real-time socket connection for authenticated user session
  useSocket();
  const activeConversationId = useChatStore((state) => state.activeConversationId);

  return (
    <div className="flex h-screen w-screen bg-darkBg text-slate-100 overflow-hidden font-sans">
      {/* Sidebar: Show full-width on mobile & tablets when no conversation is active */}
      <div className={`${activeConversationId ? 'hidden lg:flex' : 'flex'} w-full lg:w-auto h-full shrink-0`}>
        <Sidebar />
      </div>

      {/* Chat Window: Show full-width on mobile & tablets when conversation is active */}
      <div className={`${activeConversationId ? 'flex' : 'hidden lg:flex'} flex-1 h-full min-w-0`}>
        <ChatWindow />
      </div>
    </div>
  );
}
