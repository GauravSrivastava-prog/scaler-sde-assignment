import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { WebSocketProvider } from '@/context/WebSocketContext';
import { ChatProvider } from '@/context/ChatContext';
import { ToastContainer } from '@/components/UI/Toast';

export const metadata: Metadata = {
  title: 'Signal Messenger',
  description: 'Say hello to privacy. Open source Signal clone with real-time WebSockets, group chats, and disappearing messages.',
  keywords: ['Signal', 'Messenger', 'FastAPI', 'Next.js', 'WebSockets', 'Scaler Lab AI'],
  authors: [{ name: 'Scaler Lab Candidate' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="h-screen w-screen overflow-hidden bg-white dark:bg-[#121315]">
        <AuthProvider>
          <WebSocketProvider>
            <ChatProvider>
              {children}
              <ToastContainer />
            </ChatProvider>
          </WebSocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
