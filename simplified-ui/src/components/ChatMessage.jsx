import React, { useState, useEffect } from 'react';
import { Check, ChevronDown, Send, Loader2, ChevronUp, Sparkles } from 'lucide-react';
import { cn } from '../components/lib/utils'

export const ChatMessage = ({ message, isCollapsed, onClick }) => {
  const previewLength = 150;
  const needsCollapse = message.content?.length > previewLength;
  const isTranscribing = message.isTranscribing;
  const isStreaming = message.isStreaming;

  const renderContinuationIndicator = () => {
    if (!message.continuationCount) return null;

    return (
      <div className="text-xs font-medium text-muted-foreground mt-2 flex items-center gap-2">
        <div className="flex gap-1">
          {[...Array(message.continuationCount)].map((_, i) => (
            <Sparkles key={i} className="w-3 h-3 text-primary" />
          ))}
        </div>
        {message.continuationCount > 1 &&
          `${message.continuationCount} continuations`
        }
      </div>
    );
  };

  return (
    <div
      onClick={needsCollapse ? onClick : undefined}
      className={cn(
        "group relative p-6 rounded-2xl transition-all duration-300",
        "border border-transparent",
        // Only apply hover effects if not streaming
        !isStreaming && "hover:border-border hover:shadow-lg hover:shadow-background/5",
        message.role === 'user'
          ? "bg-primary/5 hover:bg-primary/10"
          : "bg-muted hover:bg-muted/80",
        needsCollapse && isCollapsed ? "cursor-pointer" : "",
        isTranscribing ? "animate-pulse" : "",
        "hextech-nordic:border-blue-500/20 hextech-nordic:hover:border-blue-500/40",
        "singed-theme:border-green-500/20 singed-theme:hover:border-green-500/40"
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          "flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full",
          message.role === 'user'
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground"
        )}>
          {message.role === 'user' ? (
            message.isTranscribing ? 'Recording...' : 'You'
          ) : (
            <>
              <Sparkles className="w-3 h-3" />
              {isStreaming ? 'AI Typing...' : 'AI'}
            </>
          )}
        </div>

        {needsCollapse && (
          <div className={cn(
            "text-xs font-medium transition-colors",
            isCollapsed ? "text-primary hover:text-primary/80" : "text-muted-foreground"
          )}>
            {isCollapsed ? 'Expand message' : 'Collapse message'}
          </div>
        )}

        {isStreaming && (
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <span key={i} className={cn(
                  "animate-bounce w-1 h-1 rounded-full",
                  "bg-primary",
                  `delay-${i * 150}`
                )}></span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={cn(
        "text-sm leading-relaxed whitespace-pre-wrap",
        "text-foreground",
        isCollapsed ? "line-clamp-3" : ""
      )}>
        {message.content}

        {isStreaming && !message.content && (
          <span className="text-muted-foreground italic">Generating response...</span>
        )}
      </div>

      {(!isStreaming && message.role === 'assistant') && renderContinuationIndicator()}

      {isStreaming && message.streamProgress && (
        <div className="mt-2 text-xs text-muted-foreground">
          Streaming... {message.streamProgress}%
        </div>
      )}
    </div>
  );
};

export const GlassPanel = ({ children, className = '', ...props }) => (
  <div
    className={cn(
      "bg-background/80 backdrop-blur-md",
      "border border-border",
      "shadow-lg shadow-background/5",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

// ModelSelector component
export const ModelSelector = ({ selectedModel, models, onSelect, isLoading }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) return (
    <div className={cn(
      "h-10 w-64 rounded-lg animate-pulse flex items-center justify-center",
      "bg-muted"
    )}>
      <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
    </div>
  );

  return (
    <div className="relative w-64">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-2.5 rounded-lg",
          "bg-background/90 border border-border",
          "shadow-sm hover:shadow-md transition-all duration-200"
        )}
      >
        <span className="font-medium text-foreground truncate">{selectedModel}</span>
        <ChevronDown className={cn(
          "w-4 h-4 text-muted-foreground transition-transform duration-200",
          isOpen ? "rotate-180" : ""
        )} />
      </button>

      {isOpen && (
        <div className={cn(
          "absolute mt-2 w-full py-1 z-50 rounded-lg",
          "bg-background/95 backdrop-blur-lg",
          "border border-border shadow-xl"
        )}>
          {models.map((model) => (
            <button
              key={model.name}
              onClick={() => {
                onSelect(model.name);
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center px-4 py-2.5 text-left",
                "hover:bg-muted/80 text-foreground"
              )}
            >
              {model.name === selectedModel && (
                <Check className="w-4 h-4 text-primary mr-2 shrink-0" />
              )}
              <span className={cn(
                "truncate",
                model.name === selectedModel ? "text-primary font-medium" : ""
              )}>
                {model.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ModelLoadingState = () => (
  <div className="h-10 w-64 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
  </div>
);


