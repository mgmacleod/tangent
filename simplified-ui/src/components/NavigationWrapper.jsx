import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { ArrowLeft } from 'lucide-react';

const NavigationWrapper = () => {
  const [view, setView] = useState('dashboard');
  const [chatState, setChatState] = useState(null);
  const [dashboardState, setDashboardState] = useState(null);

  const handleBack = () => {
    setView('dashboard');
  };

  const handleChatSelect = (conversation, position) => {
    setChatState({
      initialConversation: conversation,
      position
    });
    setView('chat');
  };

  return (
    <div className="relative w-full h-full">
      <AnimatePresence mode="wait" initial={false}>
        {view === 'dashboard' ? (
          <motion.div
            key="dashboard"
            className="absolute inset-0"
            initial={{ opacity: 0, x: "-100%" }}
            animate={{ opacity: 1, x: "0%" }}
            exit={{ opacity: 0, x: "-100%" }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30
            }}
          >
            <MainDashboard
              onConversationSelect={handleChatSelect}
              savedState={dashboardState}
              onStateChange={setDashboardState}
            />
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            className="absolute inset-0"
            initial={{ 
              opacity: 0,
              scale: 0.8,
              x: chatState?.position?.x ? chatState.position.x - window.innerWidth / 2 : 0,
              y: chatState?.position?.y ? chatState.position.y - window.innerHeight / 2 : 0
            }}
            animate={{ 
              opacity: 1,
              scale: 1,
              x: 0,
              y: 0
            }}
            exit={{
              opacity: 0,
              scale: 0.8,
              x: chatState?.position?.x ? chatState.position.x - window.innerWidth / 2 : 0,
              y: chatState?.position?.y ? chatState.position.y - window.innerHeight / 2 : 0
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30
            }}
          >
            <div className="fixed top-4 left-4 z-50">
              <Button
                variant="ghost"
                className="p-2"
                onClick={handleBack}
                aria-label="Back to Dashboard"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="ml-2">Back to Dashboard</span>
              </Button>
            </div>
            <TangentChat
              initialConversation={chatState?.initialConversation}
              onBack={handleBack}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NavigationWrapper;