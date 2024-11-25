import React, { useState } from 'react';
import { Card } from './ui/card';
import { Badge } from "./index";
import { ChevronDown, ChevronUp, X, PlusCircle, MessageCircle } from 'lucide-react';
import { RecordingButton } from './RecordingButton';
import { cn } from './lib/utils';

const generateThreadColor = (seed) => {
    const hues = [210, 330, 160, 280, 40, 190];
    const index = Math.abs(Math.floor(Math.sin(seed) * hues.length));
    return `hsl(${hues[index]}, 85%, 45%)`;
};

const calculateMessageOffset = (messages, index) => {
    return messages.slice(0, index + 1).reduce((acc, _, i) => (
        acc + (messages[i].content.length > 150 ? 160 : 120)
    ), 100);
};

const ExpandButton = ({ isExpanded, onClick }) => (
    <button
        onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    </button>
);

export const BranchNode = ({
    node,
    nodes,
    isExpanded,
    isSelected,
    onToggleExpand,
    onSelect,
    onDelete,
    onDragStart,
    onCreateBranch,
    selectedModel,
    currentMessageIndex,
    style,
    branchId // Add this prop
}) => {
    const [isRecording, setIsRecording] = useState(null);
    const [expandedMessage, setExpandedMessage] = useState(null);

    const sendMessageToLLM = async (message) => {
        try {
            const response = await fetch('http://localhost:11434/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: [...node.messages, { role: 'user', content: message }],
                    stream: false,
                    options: {}
                })
            });
            const data = await response.json();
            return data.message;
        } catch (error) {
            console.error('Error sending message:', error);
            return null;
        }
    };

    const getThreadInfo = () => {
        let currentNode = node;
        const threadChain = [];

        while (currentNode) {
            threadChain.unshift({
                id: currentNode.id,
                color: generateThreadColor(currentNode.id),
                messageCount: currentNode.messages.length
            });
            currentNode = nodes.find(n => n.id === currentNode.parentId);
        }

        return threadChain;
    };

    const handleTranscriptionComplete = async (transcript, index) => {
        setIsRecording(null);
        if (!transcript.trim()) return;

        const messages = [
            ...node.messages.slice(0, index + 1),
            { role: 'user', content: transcript }
        ];

        const aiResponse = await sendMessageToLLM(transcript);
        if (aiResponse) {
            messages.push(aiResponse);
        }

        const newPosition = {
            x: node.x + 300,
            y: node.y + calculateMessageOffset(node.messages, index) - 60
        };

        onCreateBranch(node.id, index, {
            ...newPosition,
            initialMessage: transcript,
            messages: messages,
            branchId: `${node.branchId || '0'}.${index}` // Create hierarchical branch IDs
        });
    };

    const getMessageStyles = (index, totalMessages) => {
        const threadInfo = getThreadInfo();
        const mainColor = threadInfo[threadInfo.length - 1].color;

        return {
            background: `linear-gradient(to right, ${mainColor}10, ${mainColor}25)`,
            borderLeft: `4px solid ${mainColor}`,
            borderRadius: '0.5rem',
            position: 'relative',
            transition: 'box-shadow 0.3s ease',
            boxShadow: currentMessageIndex === index ? `0 0 10px 2px ${mainColor}` : 'none',
        };
    };

    const threadInfo = getThreadInfo();
    const mainColor = threadInfo[threadInfo.length - 1].color;

    // Generate a unique key for the node
    const nodeKey = `node-${node.id}-${branchId || '0'}`;

    return (
        <div
            className="absolute transition-all duration-200"
            style={style}
            data-node-id={node.id}
            key={nodeKey}
        >
            <Card
                className={cn(
                    "branch-node relative",
                    "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
                    "border-2",
                    "hover:shadow-lg transition-all duration-300",
                    isSelected && "ring-2 ring-primary",
                    node.type !== 'main' ? "cursor-move" : "cursor-default"
                )}
                style={{
                    borderColor: mainColor,
                    maxWidth: '600px',
                    transform: style?.transform || 'none' // Ensure transform is applied
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect();
                }}
                onMouseDown={(e) => {
                    if (node.type !== 'main') {
                        e.stopPropagation();
                        onDragStart(e, node);
                    }
                }}
            >
                <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleExpand();
                                }}
                                className="p-2 rounded-full hover:bg-muted/80 transition-colors"
                            >
                                <ChevronDown
                                    className={cn(
                                        "w-5 h-5 transition-transform duration-200",
                                        !isExpanded && "-rotate-90"
                                    )}
                                    style={{ color: mainColor }}
                                />
                            </button>
                            <div className="flex flex-col">
                                <span className="text-lg font-semibold text-foreground">
                                    {node.title}
                                </span>
                                <div className="flex items-center gap-2 mt-1">
                                    <MessageCircle className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">
                                        {node.messages.length} messages
                                    </span>
                                </div>
                            </div>
                        </div>
                        {node.type !== 'main' && (
                            <button
                                className="p-2 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    {isExpanded && node.messages.length > 0 && (
                        <div className="space-y-4">
                            {node.messages.map((msg, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "relative group",
                                        currentMessageIndex === i && "ring-2 ring-primary" // Additional highlight class
                                    )}
                                    style={getMessageStyles(i, node.messages.length)}
                                >
                                    <div className="p-4 relative z-10">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant={msg.role === 'user' ? 'default' : 'secondary'}
                                                    className="text-xs"
                                                >
                                                    {msg.role === 'user' ? 'You' : 'AI'}
                                                </Badge>
                                                <span className="text-sm font-medium text-muted-foreground">
                                                    msg {i + 1} of {node.messages.length}
                                                </span>
                                            </div>
                                            {msg.content.length > 150 && (
                                                <ExpandButton
                                                    isExpanded={expandedMessage === i}
                                                    onClick={() => setExpandedMessage(expandedMessage === i ? null : i)}
                                                />
                                            )}
                                        </div>
                                        <div className={cn(
                                            "text-sm text-foreground whitespace-pre-wrap",
                                            expandedMessage !== i && msg.content.length > 150 && "line-clamp-2"
                                        )}>
                                            {msg.content}
                                        </div>
                                        <div className="mt-3 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                className="flex items-center gap-2 text-sm text-primary hover:underline"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onCreateBranch(node.id, i, {
                                                        x: node.x + 300,
                                                        y: node.y + calculateMessageOffset(node.messages, i) - 60
                                                    });
                                                }}
                                            >
                                                <PlusCircle className="w-4 h-4" />
                                                Branch from here
                                            </button>
                                            <RecordingButton
                                                variant="branch"
                                                onTranscriptionComplete={(transcript) =>
                                                    handleTranscriptionComplete(transcript, i)}
                                                onRecordingStart={() => setIsRecording(i)}
                                                onRecordingStop={() => setIsRecording(null)}
                                                className={cn(
                                                    "transition-colors",
                                                    isRecording === i && "text-destructive animate-pulse"
                                                )}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {!isExpanded && node.messages.length > 0 && (
                        <div className="mt-2 text-sm text-muted-foreground">
                            <div className="line-clamp-2">
                                Last message: {node.messages[node.messages.length - 1].content}
                            </div>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default BranchNode;