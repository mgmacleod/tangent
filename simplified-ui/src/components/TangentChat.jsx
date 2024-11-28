import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BranchNode } from './BranchNode';
import ChatInterface from './ChatInterface';
import CanvasToolbar from './CanvasToolbar';
import { MessageNavigator } from './MessageNavigator'
import { ModelStatus } from './ModelStatus'
import { cn } from "./lib/utils";

export function GridBackground({ translate, scale, className }) {
  const gridSize = 20;
  const viewWidth = window.innerWidth;
  const viewHeight = window.innerHeight;
  const offsetX = (translate.x % (gridSize * scale)) / scale;
  const offsetY = (translate.y % (gridSize * scale)) / scale;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{
        transform: `translate(${offsetX}px, ${offsetY}px)`,
      }}
    >
      <defs>
        <pattern
          id="grid"
          width={gridSize}
          height={gridSize}
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 20 0 L 0 0 0 20"
            fill="none"
            className={cn("stroke-[1.2]", className)}
          />
        </pattern>
      </defs>
      <rect
        x="-20"
        y="-20"
        width={viewWidth + 40}
        height={viewHeight + 40}
        fill="url(#grid)"
      />
    </svg>
  );
}

const defaultTemplate = {
  id: 'template',
  type: 'template',
  title: 'New Branch',
  systemPrompt: '',
  x: 50,
  y: 150,
  messages: []
};

const systemPrompt = `You are a helpful AI assistant. When responding:
1. For brief responses ("briefly", "quick", "short"):
   - Use maximum 3 sentences
   - Focus on core concepts only

2. For comprehensive responses ("tell me everything", "explain in detail"):
   - Write at least 6-8 paragraphs
   - Cover fundamentals, history, types, applications
   - Include specific examples and use cases
   - Explain technical concepts in depth
   - Break down complex topics into subtopics
   - Discuss current trends and future implications

3. For unspecified length:
   - Provide 4-5 sentences
   - Balance detail and brevity

4. Always adapt your response length based on explicit or implicit length cues in the user's question`;


const TangentChat = ({ initialConversation, selectedNodePosition }) => {
  const [nodes, setNodes] = useState(() => {
      if (!initialConversation) {
          return [{
              id: 1,
              messages: [],
              x: 100,
              y: 100,
              type: 'main',
              title: 'Main Thread',
              branchId: '0'
          }];
      }

      // Calculate positions for nodes based on their relationships
      return initialConversation.map((node, index) => {
          let x, y;
          
          if (node.type === 'main') {
              // Position main thread at the selected position or default
              x = selectedNodePosition?.x || 100;
              y = selectedNodePosition?.y || 100;
          } else {
              // Position branches relative to their parent
              const parent = initialConversation.find(n => n.id === node.parentId);
              if (parent) {
                  // Calculate position based on parent and branch index
                  const angle = (index * Math.PI) / 4; // Distribute branches in a semi-circle
                  const radius = 200; // Distance from parent
                  x = parent.x + radius * Math.cos(angle);
                  y = parent.y + radius * Math.sin(angle);
              } else {
                  x = selectedNodePosition?.x || 300;
                  y = selectedNodePosition?.y || 100;
              }
          }

          return {
              ...node,
              x,
              y
          };
      });
  });

  const [selectedNode, setSelectedNode] = useState(initialConversation?.id || 1);
  const [focusedMessageIndex, setFocusedMessageIndex] = useState(0);
  const [expandedNodes, setExpandedNodes] = useState(new Set([initialConversation?.id]));
  const [inputValue, setInputValue] = useState(''); // Changed from input to inputValue
  const [activeTool, setActiveTool] = useState('pan');
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [activeContext, setActiveContext] = useState({
    messages: [],
    systemPrompt: '',
    parentChain: []
  });
  const [dragState, setDragState] = useState({
    isDragging: false,
    nodeId: null,
    startPos: { x: 0, y: 0 },
    nodeStartPos: { x: 0, y: 0 }
  });
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'light';
    }
    return 'light';
  });
  const [streamingMessage, setStreamingMessage] = useState("");
  const [continuationCount, setContinuationCount] = useState(0);
  const lastResponseTime = useRef(null);

  const canvasRef = useRef(null);
  const nodesRef = useRef(nodes);
  const transformRef = useRef({ scale, translate });

  nodesRef.current = nodes;

  const [pressedKeys, setPressedKeys] = useState(new Set());
  const panSpeedRef = useRef({
    x: 0,
    y: 0,
    acceleration: 0
  });
  const animationFrameRef = useRef(null);

  const PAN_SETTINGS = {
    BASE_SPEED: 5,          // Starting speed in pixels per frame
    MAX_SPEED: 40,          // Maximum speed in pixels per frame
    ACCELERATION: 0.2,      // How quickly the speed increases
    DECELERATION: 0.8      // How quickly the speed decreases when key is released
  };

  // Add a sensitivity factor for panning
  const PANNING_SENSITIVITY = 0.4;
  // Add a sensitivity factor for dragging nodes

  const ZOOM_SENSITIVITY = 0.001;
  const STACK_SPACING_X = 300; // Horizontal space between branches
  const STACK_SPACING_Y = 150; // Vertical space between branches
  const STACK_START_X = 100; // Starting X position
  const STACK_START_Y = 100; // Starting Y position

  const getFullMessageHistory = useCallback((nodeId) => {
    const currentNode = nodes.find(n => n.id === nodeId);
    if (!currentNode) return [];

    // If it's the main thread or has no parent, return messages as is
    if (currentNode.type === 'main' || !currentNode.parentId) {
      return currentNode.messages;
    }

    // For branch nodes, return the contextMessages if they exist
    if (currentNode.contextMessages) {
      return currentNode.contextMessages;
    }

    // Fallback to just the node's messages if no context exists
    return currentNode.messages;
  }, [nodes]);

  useEffect(() => {
    transformRef.current = { scale, translate };
  }, [scale, translate]);

  useEffect(() => {
    const root = document.documentElement;
    // Remove all possible theme classes
    root.classList.remove('light', 'dark', 'hextech-nordic', 'singed-theme');
    // Add the selected theme
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (initialConversation && Array.isArray(initialConversation)) {
      const updatedNodes = initialConversation.map((node) => ({
        ...node,
        x: node.x ?? selectedNodePosition?.x ?? 400,
        y: node.y ?? selectedNodePosition?.y ?? 100,
      }));
      setNodes(updatedNodes);
      setExpandedNodes(new Set(updatedNodes.map((node) => node.id)));
      setSelectedNode(updatedNodes[0]?.id || 1);
    }
  }, [initialConversation, selectedNodePosition]);

  // Initialize with main thread
  useEffect(() => {
    if (nodes.length === 0) {
      setNodes([{
        id: 1,
        messages: [],
        x: 100,
        y: 100,
        type: 'main',
        title: 'Main Thread'
      }]);
      setSelectedNode(1);
    }
  }, [nodes.length]);

  // Fetch available models
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('http://localhost:11434/api/tags');
        const data = await response.json();
        setModels(data.models);
        if (data.models.length > 0) {
          setSelectedModel(data.models[0].name);
        }
      } catch (error) {
        console.error('Error fetching models:', error);
      }
    };
    fetchModels();
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !nodes.length) return;

    const viewport = {
      width: canvasRef.current.clientWidth,
      height: canvasRef.current.clientHeight
    };

    // Calculate bounds of all nodes
    const bounds = calculateNodesBounds(nodes);
    if (!bounds) return;

    // Calculate ideal scale
    const newScale = calculateIdealScale(bounds, viewport);

    // Calculate translation to center nodes
    const newTranslate = calculateCenteringTranslation(bounds, viewport, newScale);

    // Update viewport
    setScale(newScale);
    setTranslate(newTranslate);
  }, [nodes.length]); // Only run when number of nodes changes

  const handleToolSelect = useCallback((tool) => {
    setActiveTool(tool);
  }, []);

  const handleThemeChange = useCallback((newTheme) => {
    setTheme(newTheme);
  }, []);

  const focusOnMessage = useCallback((nodeId, messageIndex, zoomInClose = false) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    // Calculate message position within node
    const messageOffset = messageIndex * 120; // Approximate height per message
    const messageY = node.y + 300 + messageOffset; // 100px is base node header height

    // Center the canvas on the message
    const centerX = canvasRect.width / 2;
    const centerY = canvasRect.height / 2;

    // Calculate new translation to center the message
    const newTranslateX = centerX - (node.x + 128) * scale;
    const newTranslateY = centerY - messageY * scale;

    // Update translation
    setTranslate({
      x: newTranslateX,
      y: newTranslateY
    });

    // Set zoom level based on whether Shift is pressed
    setScale(zoomInClose ? 2 : scale);

    // Expand the node if it's not already expanded
    if (!expandedNodes.has(nodeId)) {
      setExpandedNodes(prev => new Set([...prev, nodeId]));
    }

    // Select the node
    setSelectedNode(nodeId);
    setFocusedMessageIndex(messageIndex);
  }, [nodes, scale, expandedNodes]);

  useEffect(() => {
    const updatePanSpeed = () => {
      const { acceleration } = panSpeedRef.current;
      let newAcceleration = acceleration;

      // Update acceleration based on pressed keys
      if (pressedKeys.size > 0) {
        newAcceleration = Math.min(acceleration + PAN_SETTINGS.ACCELERATION, 1);
      } else {
        newAcceleration = Math.max(acceleration - PAN_SETTINGS.DECELERATION, 0);
      }

      // Calculate current speed based on acceleration
      const currentSpeed = PAN_SETTINGS.BASE_SPEED +
        (PAN_SETTINGS.MAX_SPEED - PAN_SETTINGS.BASE_SPEED) * newAcceleration;

      // Update speeds based on pressed keys
      let dx = 0;
      let dy = 0;

      if (pressedKeys.has('arrowleft')) dx += currentSpeed;
      if (pressedKeys.has('arrowright')) dx -= currentSpeed;
      if (pressedKeys.has('arrowup')) dy += currentSpeed;
      if (pressedKeys.has('arrowdown')) dy -= currentSpeed;

      // Update pan speed ref
      panSpeedRef.current = {
        x: dx,
        y: dy,
        acceleration: newAcceleration
      };

      // Update translation if there's any movement
      if (dx !== 0 || dy !== 0 || newAcceleration > 0) {
        setTranslate(prev => ({
          x: prev.x + dx,
          y: prev.y + dy
        }));

        // Continue animation
        animationFrameRef.current = requestAnimationFrame(updatePanSpeed);
      } else {
        // Stop animation when no movement
        animationFrameRef.current = null;
      }
    };

    // Start animation if keys are pressed or if we're still decelerating
    if (pressedKeys.size > 0 || panSpeedRef.current.acceleration > 0) {
      if (!animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(updatePanSpeed);
      }
    }

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [pressedKeys]);

  const handleInputChange = (e) => {
    // If it's an event, use e.target.value, otherwise use the value directly
    const newValue = e.target ? e.target.value : e;
    setInputValue(newValue);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !selectedNode) return;

    const currentNode = nodes.find(n => n.id === selectedNode);
    if (!currentNode) return;

    setIsLoading(true);
    const newMessage = { role: 'user', content: inputValue };

    // Create initial messages arrays including the new user message
    const visibleMessages = [...currentNode.messages, newMessage];
    const contextMessages = currentNode.type === 'branch'
      ? [...(currentNode.contextMessages || []), newMessage]
      : null;
      
    // Update node with user message immediately
    setNodes(prevNodes => prevNodes.map(node =>
      node.id === selectedNode
        ? {
          ...node,
          messages: visibleMessages,
          contextMessages: currentNode.type === 'branch' ? contextMessages : undefined
        }
        : node
    ));

    setInputValue('');
    setStreamingMessage("");
    setContinuationCount(0);
    lastResponseTime.current = Date.now();

    try {
      const conversationContext = currentNode.type === 'branch'
        ? contextMessages
        : visibleMessages;

      const conversationHistory = conversationContext
        .map(msg => `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`)
        .join('\n');

      const requestBody = {
        model: selectedModel,
        prompt: `${conversationHistory}\n\nHuman: ${inputValue}\n\nAssistant:`,
        system: currentNode.systemPrompt || systemPrompt,
        stream: true,
        options: {
          temperature: 0.7,
          num_ctx: 8192,
          top_p: 0.9,
          top_k: 20,
          typical_p: 0.7,
          mirostat: 1,
          mirostat_tau: 0.8,
          mirostat_eta: 0.6,
        }
      };

      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      let accumulatedResponse = '';
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      const updateStreamingContent = (content) => {
        setStreamingMessage(content);

        // Only update the node's streamingContent field
        setNodes(prevNodes => prevNodes.map(node => {
          if (node.id !== selectedNode) return node;

          return {
            ...node,
            streamingContent: content
          };
        }));
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const data = JSON.parse(line);

              if (data.error) {
                console.error('Server returned error:', data.error);
                continue;
              }

              if (data.response !== undefined) {
                accumulatedResponse += data.response;
                updateStreamingContent(accumulatedResponse);

                const now = Date.now();
                if (lastResponseTime.current && (now - lastResponseTime.current) > 500) {
                  setContinuationCount(prev => prev + 1);
                }
                lastResponseTime.current = now;
              }
            } catch (e) {
              console.error('Error parsing JSON line:', e);
            }
          }
        }
      } finally {
        // Add the final complete message only once
        setNodes(prevNodes => prevNodes.map(node => {
          if (node.id !== selectedNode) return node;

          const finalMessage = {
            role: 'assistant',
            content: accumulatedResponse,
            continuationCount
          };

          // Get messages without any streaming message
          const baseMessages = node.messages.filter(msg => !msg.isStreaming);
          const baseContextMessages = node.type === 'branch'
            ? node.contextMessages?.filter(msg => !msg.isStreaming)
            : null;

          return {
            ...node,
            messages: [...baseMessages, finalMessage],
            contextMessages: node.type === 'branch'
              ? [...baseContextMessages, finalMessage]
              : undefined,
            streamingContent: null // Clear streaming content
          };
        }));

        setStreamingMessage(""); // Clear streaming message
        reader.releaseLock();
      }
    } catch (error) {
      console.error('Error in handleSendMessage:', error);
      setStreamingMessage("");

      // Update nodes to remove streaming state
      setNodes(prevNodes => prevNodes.map(node => ({
        ...node,
        streamingContent: null
      })));
    } finally {
      setIsLoading(false);
    }
  };

  const buildConversationContext = (node) => {
    let context = {
      messages: [],
      parentChain: []
    };

    // Build the chain of parent nodes
    let currentNode = node;
    while (currentNode) {
      context.parentChain.unshift(currentNode.id);
      if (currentNode.parentId) {
        const parentNode = nodes.find(n => n.id === currentNode.parentId);
        if (parentNode) {
          // Add messages up to the branch point
          const relevantMessages = parentNode.messages.slice(0, currentNode.parentMessageIndex + 1);
          context.messages.unshift(...relevantMessages);
          currentNode = parentNode;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    // Add the current node's messages
    context.messages.push(...node.messages);

    return context;
  };

  const handleCreateBranch = (parentNodeId, messageIndex, position = null) => {
    const parentNode = nodes.find(n => n.id === parentNodeId);
    if (!parentNode) return;

    const template = {
      ...defaultTemplate,
      title: `Branch from "${parentNode.title}"`,
      systemPrompt: parentNode.systemPrompt,
    };

    const newNode = createBranch(parentNode, template, nodes, messageIndex, position);

    // Update the active context with the full context from parent
    const branchContext = buildConversationContext(newNode);
    setActiveContext(branchContext);

    setNodes(prevNodes => [...prevNodes, newNode]);
    setSelectedNode(newNode.id);
  };

  const screenToCanvas = useCallback((screenX, screenY) => {
    const { scale, translate } = transformRef.current;
    return {
      x: (screenX - translate.x) / scale,
      y: (screenY - translate.y) / scale
    };
  }, []);

  const handleDragStart = useCallback((e, node) => {
    if (node.type === 'main') return;

    e.preventDefault();
    e.stopPropagation();

    const canvasPos = screenToCanvas(e.clientX, e.clientY);

    setDragState({
      isDragging: true,
      nodeId: node.id,
      startPos: canvasPos,
      nodeStartPos: { x: node.x, y: node.y }
    });
  }, [screenToCanvas]);

  const handleDrag = useCallback((e) => {
    if (!dragState.isDragging) return;

    const currentPos = screenToCanvas(e.clientX, e.clientY);

    const deltaX = currentPos.x - dragState.startPos.x;
    const deltaY = currentPos.y - dragState.startPos.y;

    setNodes(prevNodes =>
      prevNodes.map(node =>
        node.id === dragState.nodeId
          ? {
            ...node,
            x: dragState.nodeStartPos.x + deltaX,
            y: dragState.nodeStartPos.y + deltaY
          }
          : node
      )
    );
  }, [dragState, screenToCanvas]);

  const handleDragEnd = useCallback(() => {
    setDragState({
      isDragging: false,
      nodeId: null,
      startPos: { x: 0, y: 0 },
      nodeStartPos: { x: 0, y: 0 }
    });
  }, []);

  const getSiblingBranches = useCallback((nodeId) => {
    const currentNode = nodes.find(n => n.id === nodeId);
    if (!currentNode || !currentNode.parentId) return [];

    // Get all branches that share the same parent and parent message index
    return nodes.filter(n =>
      n.id !== nodeId &&
      n.parentId === currentNode.parentId &&
      n.parentMessageIndex === currentNode.parentMessageIndex
    ).sort((a, b) => a.y - b.y); // Sort by vertical position
  }, [nodes]);

  // Handle canvas mouse down for both panning and node dragging
  const handleCanvasMouseDown = useCallback((e) => {
    if (e.button !== 0) return;

    const target = e.target;
    const isBackground = target === canvasRef.current ||
      target.classList.contains('grid-background');

    if (activeTool === 'pan' || (activeTool === 'select' && (e.ctrlKey || e.metaKey || isBackground))) {
      e.preventDefault();
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  }, [activeTool]);

  const handleDeleteNode = (nodeId) => {
    // Also delete all child nodes
    const nodesToDelete = new Set([nodeId]);
    let foundMore = true;

    while (foundMore) {
      foundMore = false;
      nodes.forEach(node => {
        if (node.parentId && nodesToDelete.has(node.parentId) && !nodesToDelete.has(node.id)) {
          nodesToDelete.add(node.id);
          foundMore = true;
        }
      });
    }

    setNodes(nodes.filter(node => !nodesToDelete.has(node.id)));
    if (selectedNode && nodesToDelete.has(selectedNode)) {
      setSelectedNode(1); // Return to main thread
    }
  };

  // Handle zoom with proper focus point
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const { scale: currentScale, translate: currentTranslate } = transformRef.current;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Add zoom sensitivity
    const delta = -e.deltaY * ZOOM_SENSITIVITY;
    const zoom = Math.exp(delta);

    // Limit scale between 0.1 and 5 with smoother transitions
    const newScale = Math.min(Math.max(0.1, currentScale * zoom), 5);

    const mouseBeforeZoom = screenToCanvas(mouseX, mouseY);
    const scaleDiff = newScale - currentScale;
    const newTranslate = {
      x: currentTranslate.x - mouseBeforeZoom.x * scaleDiff,
      y: currentTranslate.y - mouseBeforeZoom.y * scaleDiff
    };

    setScale(newScale);
    setTranslate(newTranslate);
  }, [screenToCanvas]);

  // Function to center the main node
  const centerCanvas = useCallback(() => {
    if (!canvasRef.current) return;

    const viewport = {
      width: canvasRef.current.clientWidth,
      height: canvasRef.current.clientHeight
    };

    const bounds = calculateNodesBounds(nodes);
    if (!bounds) return;

    const newScale = calculateIdealScale(bounds, viewport);
    const newTranslate = calculateCenteringTranslation(bounds, viewport, newScale);

    setScale(newScale);
    setTranslate(newTranslate);
  }, [nodes]);

  const organizeNodesIntoStack = useCallback(() => {
    // Padding values to add space between threads
    const THREAD_HORIZONTAL_PADDING = 100; // Extra horizontal space between levels
    const THREAD_VERTICAL_PADDING = 50;    // Extra vertical space between nodes at the same level

    // Create a map to store each node's level (distance from root)
    const nodeLevels = new Map();
    const nodesByLevel = new Map();

    // Find the root node (type: 'main')
    const rootNode = nodes.find(node => node.type === 'main');
    if (!rootNode) return;

    // Calculate levels for each node using BFS
    const queue = [{ node: rootNode, level: 0 }];
    nodeLevels.set(rootNode.id, 0);

    while (queue.length > 0) {
      const { node: currentNode, level } = queue.shift();

      // Initialize array for this level if it doesn't exist
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, []);
      }
      nodesByLevel.get(level).push(currentNode);

      // Find all children of the current node
      const children = nodes.filter(n => n.parentId === currentNode.id);
      children.forEach(child => {
        if (!nodeLevels.has(child.id)) {
          nodeLevels.set(child.id, level + 1);
          queue.push({ node: child, level: level + 1 });
        }
      });
    }

    // Update node positions based on their levels
    const newNodes = nodes.map(node => {
      const level = nodeLevels.get(node.id);
      const nodesAtLevel = nodesByLevel.get(level) || [];
      const indexAtLevel = nodesAtLevel.findIndex(n => n.id === node.id);

      return {
        ...node,
        x: STACK_START_X + (level * (STACK_SPACING_X + THREAD_HORIZONTAL_PADDING)), // Add horizontal padding
        y: STACK_START_Y + (indexAtLevel * (STACK_SPACING_Y + THREAD_VERTICAL_PADDING)) // Add vertical padding
      };
    });

    // Animate to new positions
    setNodes(newNodes);

    // Center the view on the organized structure
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (canvasRect) {
      const centerX = canvasRect.width / 2;
      const centerY = canvasRect.height / 2;

      // Calculate the center of the node structure
      const avgX = newNodes.reduce((sum, node) => sum + node.x, 0) / newNodes.length;
      const avgY = newNodes.reduce((sum, node) => sum + node.y, 0) / newNodes.length;

      // Set translation to center the structure
      setTranslate({
        x: centerX - (avgX * scale),
        y: centerY - (avgY * scale)
      });
    }
  }, [nodes, scale]);

  const getConnectionPoints = (sourceNode, targetNode, expandedNodes) => {
    const isSourceExpanded = expandedNodes.has(sourceNode.id);
    const messageIndex = targetNode.parentMessageIndex || 0;
    const messageOffset = isSourceExpanded ? calculateMessageOffset(sourceNode.messages, messageIndex) : 50;

    // Determine if target is to the left or right of source
    const isTargetOnLeft = targetNode.x < sourceNode.x;

    // Source coordinates
    const sourceX = isTargetOnLeft ?
      sourceNode.x : // Connect from left edge if target is on left
      sourceNode.x + 256; // Connect from right edge if target is on right
    const sourceY = sourceNode.y + messageOffset;

    // Target coordinates
    const targetX = isTargetOnLeft ?
      targetNode.x + 256 : // Connect to right edge if target is on left
      targetNode.x; // Connect to left edge if target is on right
    const targetY = targetNode.y + 50; // Connect to top of target node

    return {
      x1: sourceX,
      y1: sourceY,
      x2: targetX,
      y2: targetY,
      isTargetOnLeft
    };
  };

  // Calculate the bounding box of all nodes
  const calculateNodesBounds = (nodes) => {
    if (!nodes.length) return null;

    return nodes.reduce((bounds, node) => {
      const nodeWidth = 256; // Fixed node width
      const nodeHeight = 100; // Base node height

      // Update bounds
      return {
        minX: Math.min(bounds.minX, node.x),
        maxX: Math.max(bounds.maxX, node.x + nodeWidth),
        minY: Math.min(bounds.minY, node.y),
        maxY: Math.max(bounds.maxY, node.y + nodeHeight)
      };
    }, {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity
    });
  };

  // Calculate the ideal scale to fit content
  const calculateIdealScale = (bounds, viewport, padding = 100) => {
    if (!bounds) return 1;

    const contentWidth = bounds.maxX - bounds.minX + padding * 2;
    const contentHeight = bounds.maxY - bounds.minY + padding * 2;

    // Calculate scale based on both dimensions
    const scaleX = (viewport.width - 384) / contentWidth; // Subtract sidebar width
    const scaleY = viewport.height / contentHeight;

    // Use the smaller scale to ensure content fits
    return Math.min(Math.min(scaleX, scaleY), 1);
  };

  // Calculate the translation to center content
  const calculateCenteringTranslation = (bounds, viewport, scale, padding = 100) => {
    if (!bounds) return { x: 0, y: 0 };

    const contentWidth = (bounds.maxX - bounds.minX + padding * 2) * scale;
    const contentHeight = (bounds.maxY - bounds.minY + padding * 2) * scale;

    // Center horizontally, accounting for sidebar
    const x = ((viewport.width - 384) - contentWidth) / 2 - bounds.minX * scale + padding * scale;
    // Center vertically
    const y = (viewport.height - contentHeight) / 2 - bounds.minY * scale + padding * scale;

    return { x, y };
  };

  const getBezierPath = (points) => {
    const { x1, y1, x2, y2, isTargetOnLeft } = points;

    // Calculate the horizontal distance between the points
    const dx = x2 - x1;

    // Adjust control points based on relative positions
    const distance = Math.abs(dx);
    const offset = Math.min(distance * 0.5, 200);

    // Create control points that produce a more natural curve
    const cp1x = x1 + (isTargetOnLeft ? -offset : offset);
    const cp1y = y1;
    const cp2x = x2 + (isTargetOnLeft ? offset : -offset);
    const cp2y = y2;

    return `M ${x1},${y1} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`;
  };

  const Connection = ({ sourceNode, targetNode, expandedNodes }) => {
    if (!sourceNode || !targetNode) return null;

    // Get connection points with relative position info
    const points = getConnectionPoints(sourceNode, targetNode, expandedNodes);

    // Generate the path
    const path = getBezierPath(points);

    // Set opacity based on expansion state
    const opacity = expandedNodes.has(sourceNode.id) ? 1 : 0.5;

    return (
      <path
        d={path}
        className="stroke-primary dark:stroke-primary"
        style={{
          opacity,
          transition: 'all 0.2s ease-in-out'
        }}
        strokeWidth="2"
        fill="none"
      />
    );
  };

  // Helper function to calculate message offset (unchanged but included for completeness)
  const calculateMessageOffset = (messages, index) => {
    if (!messages || index < 0) return 50;
    return messages.slice(0, index + 1).reduce((acc, msg) => {
      const contentHeight = msg.content.length > 150 ? 160 : 120;
      return acc + contentHeight;
    }, 100);
  };

  const createBranch = (parentNode, template, nodes, messageIndex, position = null) => {
    const newId = nodes.length > 0 ? Math.max(...nodes.map(n => n.id)) + 1 : 1;

    // Get the full context for the branch
    const contextMessages = parentNode.messages.slice(0, messageIndex + 1);

    return {
      id: newId,
      // Visual messages only show the branched message
      messages: [parentNode.messages[messageIndex]],
      x: position?.x ?? parentNode.x + 300,
      y: position?.y ?? (parentNode.y + calculateMessageOffset(parentNode.messages, messageIndex) - 60),
      type: 'branch',
      title: template.title || `Branch ${newId}`,
      parentId: parentNode.id,
      systemPrompt: template.systemPrompt,
      collapsed: true,
      parentMessageIndex: messageIndex,
      // Keep full context in a separate property
      contextMessages: contextMessages
    };
  };

  const getConnectedBranches = (nodeId, messageIndex) => {
    const currentNode = nodes.find(n => n.id === nodeId);
    if (!currentNode) return { left: [], right: [], parent: null };

    // Get parent info
    const parent = currentNode.parentId ? nodes.find(n => n.id === currentNode.parentId) : null;
    const parentPosition = parent ? getNodePosition(currentNode, parent) : null;

    // Get all child branches at current message
    const children = nodes.filter(n =>
      n.parentId === currentNode.id &&
      n.parentMessageIndex === messageIndex
    );

    // Sort children by x position
    const leftBranches = children.filter(n => n.x < currentNode.x)
      .sort((a, b) => b.x - a.x); // Sort from closest to furthest
    const rightBranches = children.filter(n => n.x >= currentNode.x)
      .sort((a, b) => a.x - b.x); // Sort from closest to furthest

    return {
      left: leftBranches,
      right: rightBranches,
      parent: parent ? { node: parent, position: parentPosition } : null
    };
  };

  const handleNavigation = useCallback((direction) => {
    const currentNode = nodes.find(n => n.id === selectedNode);
    if (!currentNode) return;

    const branches = getConnectedBranches(selectedNode, focusedMessageIndex);
    const siblingBranches = getSiblingBranches(selectedNode);

    switch (direction) {
      case 'up': {
        if (focusedMessageIndex > 0) {
          // Regular message navigation
          focusOnMessage(selectedNode, focusedMessageIndex - 1);
        } else {
          // Try to find a sibling branch above
          const siblingAbove = siblingBranches.reverse().find(n => n.y < currentNode.y);
          if (siblingAbove) {
            // Jump to the last message of the sibling branch above
            const siblingMessages = siblingAbove.messages.length;
            focusOnMessage(siblingAbove.id, Math.max(0, siblingMessages - 1));
          }
        }
        break;
      }

      case 'down': {
        if (focusedMessageIndex < currentNode.messages.length - 1) {
          // Regular message navigation
          focusOnMessage(selectedNode, focusedMessageIndex + 1);
        } else {
          // Try to find a sibling branch below
          const siblingBelow = siblingBranches.find(n => n.y > currentNode.y);
          if (siblingBelow) {
            // Jump to the first message of the sibling branch below
            focusOnMessage(siblingBelow.id, 0);
          }
        }
        break;
      }

      case 'left': {
        if (branches.parent?.position === 'left') {
          focusOnMessage(branches.parent.node.id, currentNode.parentMessageIndex);
        } else if (branches.left.length > 0) {
          const currentIndex = branches.left.findIndex(n => n.id === selectedNode);
          const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % branches.left.length;
          focusOnMessage(branches.left[nextIndex].id, 0);
        }
        break;
      }

      case 'right': {
        if (branches.parent?.position === 'right') {
          focusOnMessage(branches.parent.node.id, currentNode.parentMessageIndex);
        } else if (branches.right.length > 0) {
          const currentIndex = branches.right.findIndex(n => n.id === selectedNode);
          const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % branches.right.length;
          focusOnMessage(branches.right[nextIndex].id, 0);
        }
        break;
      }
    }
  }, [nodes, selectedNode, focusedMessageIndex, focusOnMessage, getConnectedBranches, getSiblingBranches]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA') return;

      if (!selectedNode) return;

      const currentNode = nodes.find(n => n.id === selectedNode);
      if (!currentNode) return;

      const isShiftPressed = e.shiftKey;
      const branches = getConnectedBranches(selectedNode, focusedMessageIndex);
      const siblingBranches = getSiblingBranches(selectedNode);

      switch (e.key.toLowerCase()) {
        case 'w': {
          if (focusedMessageIndex > 0) {
            focusOnMessage(selectedNode, focusedMessageIndex - 1, isShiftPressed);
          } else {
            const siblingAbove = siblingBranches.reverse().find(n => n.y < currentNode.y);
            if (siblingAbove) {
              const siblingMessages = siblingAbove.messages.length;
              focusOnMessage(siblingAbove.id, Math.max(0, siblingMessages - 1), isShiftPressed);
            }
          }
          break;
        }

        case 's': {
          if (focusedMessageIndex < currentNode.messages.length - 1) {
            focusOnMessage(selectedNode, focusedMessageIndex + 1, isShiftPressed);
          } else {
            const siblingBelow = siblingBranches.find(n => n.y > currentNode.y);
            if (siblingBelow) {
              focusOnMessage(siblingBelow.id, 0, isShiftPressed);
            }
          }
          break;
        }

        case 'a': {
          if (branches.parent?.position === 'left') {
            focusOnMessage(branches.parent.node.id, currentNode.parentMessageIndex, isShiftPressed);
          } else if (branches.left.length > 0) {
            const currentIndex = branches.left.findIndex(n => n.id === selectedNode);
            const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % branches.left.length;
            focusOnMessage(branches.left[nextIndex].id, 0, isShiftPressed);
          }
          break;
        }

        case 'd': {
          if (branches.parent?.position === 'right') {
            focusOnMessage(branches.parent.node.id, currentNode.parentMessageIndex, isShiftPressed);
          } else if (branches.right.length > 0) {
            const currentIndex = branches.right.findIndex(n => n.id === selectedNode);
            const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % branches.right.length;
            focusOnMessage(branches.right[nextIndex].id, 0, isShiftPressed);
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, focusedMessageIndex, nodes, focusOnMessage, getConnectedBranches, getSiblingBranches]);

  const getNodePosition = (sourceNode, targetNode) => {
    return targetNode.x < sourceNode.x ? 'left' : 'right';
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check if the active element is a text input or textarea
      const isTyping = document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA';

      // If user is typing in an input field, only handle shortcuts with modifier keys
      if (isTyping && !e.ctrlKey && !e.metaKey) {
        return;
      }

      // Handle all keyboard shortcuts in one place
      switch (e.key.toLowerCase()) {
        case 'c':
          centerCanvas();
          break;
        case 'o':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault(); // Prevent saving
            organizeNodesIntoStack();
          }
          break;
        case 'g':
          setActiveTool('select');
          break;
        case 'h':
          setActiveTool('pan');
          break;
        case 's':
          setActiveTool('select');
          break;
        case ' ':
          if (activeTool === 'pan') {
            setActiveTool('pan');
          }
          break;
      }
    };

    const handleKeyUp = (e) => {
      // Only handle space key for pan tool when not typing
      const isTyping = document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA';

      if (!isTyping && e.key === ' ' && activeTool === 'pan') {
        setActiveTool('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [centerCanvas, organizeNodesIntoStack, activeTool]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Attach the wheel event listener with passive: false to allow preventDefault
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    // Cleanup the event listener on unmount
    return () => {
      canvas.removeEventListener('wheel', handleWheel, { passive: false });
    };
  }, [handleWheel]);

  const handleToggleExpand = useCallback((nodeId) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (dragState.isDragging) {
        handleDrag(e);
      } else if (isPanning) {
        const dx = (e.clientX - lastMousePos.x) * PANNING_SENSITIVITY;
        const dy = (e.clientY - lastMousePos.y) * PANNING_SENSITIVITY;

        setTranslate(prev => ({
          x: prev.x + dx,
          y: prev.y + dy
        }));

        setLastMousePos({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseUp = () => {
      if (dragState.isDragging) {
        handleDragEnd();
      }
      setIsPanning(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, isPanning, handleDrag, handleDragEnd, lastMousePos]);

  return (
    <div className="relative flex h-full bg-background overflow-hidden">
      {/* Canvas Area */}
      <div
        ref={canvasRef}
        className={cn(
          "absolute inset-0 overflow-hidden select-none",
          isPanning ? "cursor-grabbing" : activeTool === "pan" ? "cursor-grab" : "cursor-default"
        )}
        onMouseDown={handleCanvasMouseDown}
        style={{ touchAction: 'none' }}
      >
        {/* Grid Background */}
        <GridBackground
          translate={translate}
          scale={scale}
          className="stroke-border dark:stroke-border"
        />

        {/* Canvas Toolbar */}
        <div className="absolute top-4 z-3">
          <CanvasToolbar
            activeTool={activeTool}
            onToolSelect={handleToolSelect}
            theme={theme}
            onThemeChange={handleThemeChange}
            selectedModel={selectedModel}
            models={models}
            onModelSelect={setSelectedModel}
          />
        </div>

        {/* Nodes and Connections */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          {/* SVG for connections */}
          <svg
            className="absolute"
            style={{
              width: '100%',
              height: '100%',
              overflow: 'visible',
              pointerEvents: 'none'
            }}
          >
            {nodes.map((node) => {
              if (!node.parentId) return null;

              const parent = nodes.find(n => n.id === node.parentId);
              if (!parent) return null;

              return (
                <Connection
                  key={`connection-${parent.id}-${node.id}`}
                  sourceNode={parent}
                  targetNode={node}
                  expandedNodes={expandedNodes}
                />
              );
            })}
          </svg>

          {/* Node components */}
          {nodes.map((node) => {
            const nodeKey = `node-${node.id}-${node.branchId || '0'}`;

            return (
              <BranchNode
                key={nodeKey}
                node={node}
                nodes={nodes}
                isExpanded={expandedNodes.has(node.id)}
                isSelected={selectedNode === node.id}
                onToggleExpand={() => handleToggleExpand(node.id)}
                onSelect={() => setSelectedNode(node.id)}
                onDelete={() => handleDeleteNode(node.id)}
                onDragStart={handleDragStart}
                onCreateBranch={handleCreateBranch}
                selectedModel={selectedModel}
                currentMessageIndex={node.id === selectedNode ? focusedMessageIndex : null}
                branchId={node.branchId}
                style={{
                  position: 'absolute',
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: '256px',
                  zIndex: selectedNode === node.id ? 10 : 1
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Chat Sidebar */}
      <div className="absolute right-0 top-40 bottom-0 w-96 bg-background border-l border-border">
        {selectedNode && (
          <>
            <div className="flex gap-2 p-2 border border-border">
              <MessageNavigator
                currentNode={nodes.find(n => n.id === selectedNode)}
                currentIndex={focusedMessageIndex}
                totalMessages={nodes.find(n => n.id === selectedNode)?.messages.length || 0}
                onNavigate={handleNavigation}
                branches={getConnectedBranches(selectedNode, focusedMessageIndex)}
              />
              <ModelStatus
                selectedModel={selectedModel}
                isLoading={isLoading}
                temperature={0.7}
              />
            </div>
            <div className="overflow-hidden">
              <ChatInterface
                messages={getFullMessageHistory(selectedNode)}
                input={inputValue}
                isLoading={isLoading}
                onInputChange={handleInputChange}
                onSend={handleSendMessage}
                streamingMessage={streamingMessage}
                continuationCount={continuationCount}
                activeNode={nodes.find(n => n.id === selectedNode)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TangentChat;