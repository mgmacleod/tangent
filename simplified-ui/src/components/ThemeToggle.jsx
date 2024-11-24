import React from 'react';
import { Sun, Moon, Sparkles, Atom } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export function ThemeToggle({ theme, setTheme }) {
  const themes = [
    {
      name: 'light',
      icon: Sun,
      label: 'Light',
      className: 'text-amber-500'
    },
    {
      name: 'dark',
      icon: Moon,
      label: 'Dark',
      className: 'text-slate-900 dark:text-slate-100'
    },
    {
      name: 'hextech-nordic',
      icon: Sparkles,
      label: 'Nordic',
      className: 'text-[hsl(195,96%,65%)]'
    },
    {
        name: 'singed-theme',
        icon: Atom,
        label: 'Cyber',  // Changed from 'Singed' to match the cyber theme
        className: 'text-[hsl(155,70%,35%)]'  // Updated to match new primary color
      }
  ];

  const currentTheme = themes.find(t => t.name === theme) || themes[0];
  const Icon = currentTheme.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={`w-8 h-8 transition-colors ${
            theme === 'hextech-nordic' ? 'glow pulse' : ''
          }`}
        >
          <Icon className={`h-4 w-4 transition-all ${themes.find(t => t.name === theme)?.className}`} />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {themes.map((t) => {
          const ThemeIcon = t.icon;
          return (
            <DropdownMenuItem
              key={t.name}
              onClick={() => {
                document.documentElement.classList.remove('light', 'dark', 'hextech-nordic', 'singed-theme');
                document.documentElement.classList.add(t.name);
                setTheme(t.name);
                localStorage.setItem('theme', t.name);
              }}
              className={`
                flex items-center gap-2 cursor-pointer transition-colors
                ${theme === t.name ? 'bg-accent' : ''}
                ${t.name === 'hextech-nordic' ? 'hover:text-[hsl(195,96%,65%)]' : ''}
              `}
            >
              <ThemeIcon className={`h-4 w-4 ${t.className}`} />
              <span>{t.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
