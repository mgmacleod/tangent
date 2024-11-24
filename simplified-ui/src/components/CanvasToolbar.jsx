import React from 'react';
import { MousePointer, Hand, Sun, Moon, Laptop, Palette, Bot } from 'lucide-react';
import { cn } from './lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"

const tools = [
  { id: 'select', icon: MousePointer, label: 'Select and move threads (S)' },
  { id: 'pan', icon: Hand, label: 'Pan canvas (H)' }
];

const ToolButton = ({ tool, isActive, onClick }) => {
  const Icon = tool.icon;
  
  return (
    <div className="relative">
      <button
        onClick={() => onClick(tool.id)}
        className={cn(
          "p-2 rounded-lg transition-all duration-200 relative group",
          "hover:bg-secondary",
          isActive ? "bg-primary/20 text-primary" : "text-muted-foreground",
          "light:hover:bg-gray-100 dark:hover:bg-gray-800",
          "hextech-nordic:hover:bg-blue-900/20 hextech-nordic:active:bg-blue-800/30",
          "singed-theme:hover:bg-green-900/20 singed-theme:active:bg-green-800/30"
        )}
        title={tool.label}
      >
        <Icon className="w-5 h-5" />
        <span className={cn(
          "absolute hidden group-hover:block",
          "left-14 top-1/2 -translate-y-1/2", // Position to the right of the button
          "px-2 py-1 text-xs rounded whitespace-nowrap",
          "bg-popover text-popover-foreground",
          "shadow-md border border-border",
          "z-50"
        )}>
          {tool.label}
        </span>
      </button>
    </div>
  );
};


function CanvasToolbar({ 
  activeTool, 
  onToolSelect, 
  theme, 
  onThemeChange,
  selectedModel,
  models = [],
  onModelSelect
}) {
  return (
    <div className={cn(
      "fixed top-40 left-4 rounded-xl shadow-lg p-1 space-y-2 flex flex-col items-center",
      "bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      "border border-border"
    )}>
      {tools.map(tool => (
        <ToolButton
          key={tool.id}
          tool={tool}
          isActive={activeTool === tool.id}
          onClick={onToolSelect}
        />
      ))}
      
      <div className="w-full h-px bg-border" />
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="relative">
            <button
              className={cn(
                "p-2 rounded-lg transition-all duration-200 relative group",
                "hover:bg-secondary text-muted-foreground",
                "light:hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
              title="Select Model"
            >
              <Bot className="w-5 h-5" />
              <span className={cn(
                "absolute hidden group-hover:block",
                "left-14 top-1/2 -translate-y-1/2", // Position to the right of the button
                "px-2 py-1 text-xs rounded whitespace-nowrap",
                "bg-popover text-popover-foreground",
                "shadow-md border border-border",
                "z-50"
              )}>
                {selectedModel || 'Select Model'}
              </span>
            </button>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          side="right" 
          align="start" 
          className="min-w-[200px]"
        >
          {models.map((model) => (
            <DropdownMenuItem 
              key={model.name}
              className="flex items-center justify-between"
              onClick={() => onModelSelect(model.name)}
            >
              <span>{model.name}</span>
              {selectedModel === model.name && (
                <span className="h-2 w-2 rounded-full bg-primary"/>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="w-full h-px bg-border" />
    </div>
  );
}

export default CanvasToolbar;