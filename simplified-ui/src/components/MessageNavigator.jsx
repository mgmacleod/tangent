import React from 'react';
import { cn } from '../components/lib/utils';

export const MessageNavigator = ({
  currentNode,
  currentIndex,
  totalMessages,
  onNavigate,
  branches
}) => {
  if (!currentNode) {
    return (
      <div className="fixed bottom-2 left-2 p-1.5 rounded-md text-[10px] bg-muted text-muted-foreground">
        No current node selected
      </div>
    );
  }

  const canGoUp = currentIndex > 0;
  const canGoDown = currentIndex < totalMessages - 1;
  const hasLeft = branches.left.length > 0 || branches.parent?.position === 'left';
  const hasRight = branches.right.length > 0 || branches.parent?.position === 'right';

  return (
    <div className={cn(
      "fixed bottom-2 left-2 p-1.5 rounded-md text-[10px]",
      "bg-background/80 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60",
      "shadow-sm border border-border"
    )}>
      <div className="flex items-center gap-1">
        {/* Left navigation */}
        <div className="relative">
          <button 
            onClick={() => onNavigate('left')}
            className={cn(
              "px-1 rounded transition-colors",
              hasLeft
                ? "bg-primary/20 text-primary hover:bg-primary/30 cursor-pointer" 
                : "bg-muted text-muted-foreground cursor-not-allowed"
          )}>A</button>
          {branches.left.length > 1 && (
            <span className="absolute -top-2 -right-1 text-[8px] text-primary">
              {branches.left.length}
            </span>
          )}
        </div>
        
        {/* Message navigation */}
        <div className="flex flex-col gap-0.5">
          <button 
            onClick={() => onNavigate('up')}
            className={cn(
              "px-1 rounded transition-colors",
              canGoUp
                ? "bg-primary/20 text-primary hover:bg-primary/30 cursor-pointer" 
                : "bg-muted text-muted-foreground cursor-not-allowed"
          )}>W</button>
          <button 
            onClick={() => onNavigate('down')}
            className={cn(
              "px-1 rounded transition-colors",
              canGoDown
                ? "bg-primary/20 text-primary hover:bg-primary/30 cursor-pointer" 
                : "bg-muted text-muted-foreground cursor-not-allowed"
          )}>S</button>
        </div>

        {/* Right navigation */}
        <div className="relative">
          <button 
            onClick={() => onNavigate('right')}
            className={cn(
              "px-1 rounded transition-colors",
              hasRight
                ? "bg-primary/20 text-primary hover:bg-primary/30 cursor-pointer" 
                : "bg-muted text-muted-foreground cursor-not-allowed"
          )}>D</button>
          {branches.right.length > 1 && (
            <span className="absolute -top-2 -right-1 text-[8px] text-primary">
              {branches.right.length}
            </span>
          )}
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
};