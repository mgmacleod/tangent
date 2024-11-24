import React from 'react';
import { cn } from '../components/lib/utils';


// MessageNavigator.jsx
export const MessageNavigator = ({
  currentNode,
  currentIndex,
  connectedNodes,
  totalMessages
}) => (
  <div className={cn(
    "fixed bottom-2 left-2 p-1.5 rounded-md text-[10px]",
    "bg-background/80 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60",
    "shadow-sm border border-border"
  )}>
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        <button className={cn(
          "px-1 rounded transition-colors",
          connectedNodes.left 
            ? "bg-primary/20 text-primary hover:bg-primary/30" 
            : "bg-muted text-muted-foreground"
        )}>←</button>
        <button className={cn(
          "px-1 rounded transition-colors",
          connectedNodes.right.length > 0 
            ? "bg-primary/20 text-primary hover:bg-primary/30" 
            : "bg-muted text-muted-foreground"
        )}>→</button>
      </div>
      <span className="text-muted-foreground px-1">
        {currentIndex + 1}/{totalMessages}
      </span>
      <span className={cn(
        "px-1 rounded",
        "bg-primary/20 text-primary"
      )}>
        {currentNode.type === 'main' ? 'M' : `B${currentNode.id}`}
      </span>
    </div>
  </div>
);

export default MessageNavigator;