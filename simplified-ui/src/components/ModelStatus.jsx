import React from 'react';
import { Bot } from 'lucide-react';
import { cn } from './lib/utils';

export const ModelStatus = ({
  selectedModel,
  isLoading,
  temperature = 0.7,
  className
}) => {
  // Extract model name and size if following format "model-name:size"
  const [modelName, modelSize] = (selectedModel || '').split(':');
  
  return (
    <div className={cn(
      "fixed bottom-2 right-2 p-1.5 rounded-md text-[10px]",
      "bg-background/80 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60",
      "shadow-sm border border-border",
      className
    )}>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Bot className="h-3 w-3 text-primary" />
          <span className={cn(
            "px-1 rounded",
            "bg-primary/20 text-primary"
          )}>
            {modelName || 'No model selected'}
          </span>
        </div>

        {modelSize && (
          <span className="text-muted-foreground px-1 border-l border-border">
            {modelSize}
          </span>
        )}

        <span className="text-muted-foreground px-1 border-l border-border">
          T={temperature}
        </span>

        {isLoading && (
          <div className="w-2 h-2 rounded-full bg-primary/80 animate-pulse" />
        )}
      </div>
    </div>
  );
};

export default ModelStatus;