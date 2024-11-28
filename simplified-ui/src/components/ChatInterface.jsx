import React, { useRef, useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Send, Loader2 } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { RecordingButton } from './RecordingButton';
import { cn } from '../components/lib/utils';

const ScrollButtons = ({
  containerRef,
  showScrollTop,
  showScrollBottom,
  onScrollTop,
  onScrollBottom
}) => {
  if (!showScrollTop && !showScrollBottom) return null;

  return (
    <div className="absolute right-8 bottom-4 flex flex-col gap-2 z-20">
      {showScrollTop && (
        <button
          onClick={onScrollTop}
          className={cn(
            "p-2.5 rounded-full transition-all duration-300",
            "bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60",
            "border border-border hover:border-border/80",
            "shadow-lg hover:shadow-xl",
            "group"
          )}
          aria-label="Scroll to top"
        >
          <ChevronUp className={cn(
            "w-5 h-5",
            "text-muted-foreground group-hover:text-foreground",
            "transition-colors"
          )} />
        </button>
      )}

      {showScrollBottom && (
        <button
          onClick={onScrollBottom}
          className={cn(
            "p-2.5 rounded-full transition-all duration-300",
            "bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60",
            "border border-border hover:border-border/80",
            "shadow-lg hover:shadow-xl",
            "group"
          )}
          aria-label="Scroll to bottom"
        >
          <ChevronDown className={cn(
            "w-5 h-5",
            "text-muted-foreground group-hover:text-foreground",
            "transition-colors"
          )} />
        </button>
      )}
    </div>
  );
};

const ChatInterface = ({
  messages = [],
  input = '',
  isLoading = false,
  onInputChange,
  onSend,
  activeNode,
  streamingMessage,
  continuationCount
}) => {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [expandedMessage, setExpandedMessage] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [lastMessageCount, setLastMessageCount] = useState(messages.length);

  const shouldAutoScroll = useRef(true);
  const isNearBottom = useRef(true);

  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesContainerRef.current) {
      const scrollHeight = messagesContainerRef.current.scrollHeight;
      messagesContainerRef.current.scrollTo({
        top: scrollHeight,
        behavior
      });
    }
  };

  const scrollToTop = () => {
    messagesContainerRef.current?.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const bottomThreshold = 100;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

    // Update auto-scroll behavior based on user's scroll position
    isNearBottom.current = distanceFromBottom <= bottomThreshold;
    shouldAutoScroll.current = isNearBottom.current;

    setShowScrollTop(scrollTop > 100);
    setShowScrollBottom(distanceFromBottom > bottomThreshold);
  };

  const handleTranscriptionComplete = (transcript) => {
    onInputChange({ target: { value: transcript } });
    setIsTranscribing(false);
    // Auto send the transcribed message
    if (transcript.trim()) {
      onSend();
    }
  };

  const handleTranscriptionStart = () => {
    setIsTranscribing(true);
    onInputChange({ target: { value: '' } });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading && !isTranscribing) {
        onSend();
      }
    }
  };

  // Scroll handling for new messages and streaming
  useEffect(() => {
    if (messages.length !== lastMessageCount) {
      setLastMessageCount(messages.length);
      scrollToBottom('auto');
    }
  }, [messages, lastMessageCount]);

  useEffect(() => {
    if (streamingMessage && shouldAutoScroll.current) {
      scrollToBottom('auto');
    }
  }, [streamingMessage]);

  // Initial scroll button visibility
  useEffect(() => {
    handleScroll();
  }, [messages]);

  // Auto-expand latest message
  useEffect(() => {
    if (messages.length > 0) {
      setExpandedMessage(messages.length - 1);
    }
  }, [messages.length]);

  return (
    <div className="h-[75vh] flex flex-col">
      {/* Header */}
      <div className={cn(
        "flex-shrink-0 px-6 py-4 border-b border-border",
        "bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      )}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">
            {activeNode?.title || 'Chat Thread'}
          </h2>
          <span className="text-sm text-muted-foreground">
            {activeNode?.type === 'main' ? 'Main Thread' : `Branch ${activeNode?.id}`}
          </span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 bg-background/50 backdrop-blur-sm">
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="space-y-4"
        >
          {messages.map((message, i) => (
            <ChatMessage
              key={`${i}-${message.content}`}
              message={{
                ...message,
                isTranscribing: isTranscribing && i === messages.length - 1
              }}
              isCollapsed={expandedMessage !== i}
              onClick={() => setExpandedMessage(expandedMessage === i ? null : i)}
            />
          ))}

          {streamingMessage && (
            <ChatMessage
              message={{
                role: 'assistant',
                content: streamingMessage,
                isStreaming: true,
                continuationCount
              }}
              isCollapsed={false}
            />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Scroll Buttons */}
        <ScrollButtons
          containerRef={messagesContainerRef}
          showScrollTop={showScrollTop}
          showScrollBottom={showScrollBottom}
          onScrollTop={scrollToTop}
          onScrollBottom={() => {
            shouldAutoScroll.current = true;
            scrollToBottom();
          }}
        />
      </div>

      {/* Input Area */}
      <div className={cn(
        "flex-shrink-0 mt-auto p-4 pt-6 border-t pb-3 border-border",
        "bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      )}>
        <div className="flex gap-3">
          <textarea
            value={input}
            onChange={onInputChange}
            onKeyDown={handleKeyDown}
            placeholder="hola como estas?"
            rows={1}
            className={cn(
              "flex-1 px-4 py-3 rounded-xl resize-none",
              "bg-muted/50 border border-border",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
              "placeholder:text-muted-foreground",
              "transition-all duration-300",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "hextech-nordic:bg-blue-950/10 hextech-nordic:border-blue-400/20",
              "singed-theme:bg-green-950/10 singed-theme:border-green-400/20"
            )}
            disabled={isLoading || isTranscribing}
          />

          <RecordingButton
            onTranscriptionComplete={handleTranscriptionComplete}
            onTranscriptionStart={handleTranscriptionStart}
            onRecordingStop={() => setIsTranscribing(false)}
            disabled={isLoading}
          />

          <button
            onClick={() => {
              if (input.trim() && !isLoading && !isTranscribing) {
                onSend();
              }
            }}
            disabled={!input.trim() || isLoading || isTranscribing}
            className={cn(
              "px-5 py-3 rounded-xl transition-all duration-300",
              "bg-primary text-primary-foreground",
              "hover:bg-primary/90",
              "shadow-md hover:shadow-lg",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "hextech-nordic:bg-gradient-to-r hextech-nordic:from-blue-500 hextech-nordic:to-blue-600",
              "hextech-nordic:hover:from-blue-600 hextech-nordic:hover:to-blue-700",
              "singed-theme:bg-gradient-to-r singed-theme:from-green-500 singed-theme:to-green-600",
              "singed-theme:hover:from-green-600 singed-theme:hover:to-green-700"
            )}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );


};

export default ChatInterface;