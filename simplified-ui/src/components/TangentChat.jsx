import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, ArrowLeft } from 'lucide-react';
import { BranchNode } from './BranchNode';
import ChatInterface from './ChatInterface';
import { ModelSelector } from './ChatMessage';
import CanvasToolbar from './CanvasToolbar';
import { TangentLogo } from './TangentLogo';
import { MessageNavigator } from './MessageNavigator'
import { ModelStatus } from './ModelStatus'
import { Button } from './index';
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

export const getBezierPath = (source, target) => {
  const deltaX = target.x - source.x;
  const deltaY = target.y - source.y;
  const controlPointOffset = deltaX / 2;

  return `M${source.x},${source.y} C${source.x + controlPointOffset},${source.y} ${target.x - controlPointOffset},${target.y} ${target.x},${target.y}`;
};

const calculateNodeHeight = (node, isExpanded) => {
  if (!isExpanded) return 100;
  return 100 + node.messages.length * 120;
};

const getConnectionPoints = (sourceNode, targetNode, expandedNodes) => {
  const sourceHeight = calculateNodeHeight(sourceNode, expandedNodes.has(sourceNode.id));
  const targetHeight = calculateNodeHeight(targetNode, expandedNodes.has(targetNode.id));

  return {
    x1: sourceNode.x + 128,
    y1: sourceNode.y + (expandedNodes.has(sourceNode.id) ? sourceHeight / 2 : 32),
    x2: targetNode.x + 128,
    y2: targetNode.y + (expandedNodes.has(targetNode.id) ? targetHeight / 2 : 32),
  };
};

const defaultTemplate = {
  id: 'template',
  type: 'template',
  title: 'New Branch',
  systemPrompt: '',
  x: 50,
  y: 150,
  messages: []
};

const createBranch = (parentNode, template, nodes, messageIndex, position = null) => {
  const newId = nodes.length > 0 ? Math.max(...nodes.map(n => n.id)) + 1 : 1;
  const messages = position?.messages || parentNode.messages.slice(0, messageIndex + 1);

  return {
    id: newId,
    messages: messages,
    x: position?.x ?? parentNode.x + 300,
    y: position?.y ?? parentNode.y,
    type: 'branch',
    title: template.title || `Branch ${newId}`,
    parentId: parentNode.id,
    systemPrompt: template.systemPrompt,
    collapsed: true,
    parentMessageIndex: messageIndex
  };
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



const TangentChat = ({ initialConversation, selectedNodePosition, onBack }) => {
  const [nodes, setNodes] = useState(() => {
    if (initialConversation && Array.isArray(initialConversation)) {
      // Ensure each node has x and y coordinates
      return initialConversation.map((node) => ({
        ...node,
        x: node.x ?? selectedNodePosition?.x ?? 400,
        y: node.y ?? selectedNodePosition?.y ?? 100,
      }));
    }
    return [
      {
        id: 1,
        messages: [],
        x: 100,
        y: 100,
        type: 'main',
        title: 'Main Thread',
      },
    ];
  });


  const [selectedNode, setSelectedNode] = useState(initialConversation?.id || 1);
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
  const [focusedMessageIndex, setFocusedMessageIndex] = useState(0);
  const [activeBranchIndex, setActiveBranchIndex] = useState(0);
  const [activeContext, setActiveContext] = useState({
    messages: [],
    systemPrompt: '',
    parentChain: []
  });
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [dragState, setDragState] = useState({
    isDragging: false,
    nodeId: null,
    startPos: { x: 0, y: 0 },
    nodeStartPos: { x: 0, y: 0 }
  });
  const nodePositionRef = useRef({ x: 0, y: 0 });
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'light';
    }
    return 'light';
  });
  const [streamingMessage, setStreamingMessage] = useState("");
  const [continuationCount, setContinuationCount] = useState(0);
  const lastResponseTime = useRef(null);

  // State variables for panning
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef(null);
  const nodesRef = useRef(nodes);
  const draggedNodeRef = useRef(null);
  const transformRef = useRef({ scale, translate });

  nodesRef.current = nodes;

  const [isDragging, setIsDragging] = useState(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const nodeStartPosRef = useRef({ x: 0, y: 0 });

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
  const DRAGGING_SENSITIVITY = 0.2;

  const ZOOM_SENSITIVITY = 0.001;
  const STACK_SPACING_X = 300; // Horizontal space between branches
  const STACK_SPACING_Y = 150; // Vertical space between branches
  const STACK_START_X = 100; // Starting X position
  const STACK_START_Y = 100; // Starting Y position

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
      // Ensure each node has x and y coordinates
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

  
  useEffect(() => {
    if (initialConversation) {
      // Auto-expand the conversation node after animation
      setExpandedNodes(new Set([initialConversation.id]));
      setSelectedNode(initialConversation.id);
    }
  }, [initialConversation]);


  useEffect(() => {
    if (initialConversation) {
      // Create the initial context from the imported conversation
      const initialContext = {
        messages: initialConversation.messages || [],
        systemPrompt: initialConversation.systemPrompt || systemPrompt,
        parentChain: []
      };
      setActiveContext(initialContext);

      // Set up the initial node with the conversation history
      setNodes([{
        id: 1,
        messages: [],
        x: 100,
        y: 100,
        type: 'main',
        title: 'Main Thread'
      }, {
        ...initialConversation,
        messages: initialConversation.messages || []
      }]);
    }
  }, [initialConversation]);
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

  const handleToolSelect = useCallback((tool) => {
    setActiveTool(tool);
  }, []);

  const handleThemeChange = useCallback((newTheme) => {
    setTheme(newTheme);
  }, []);

  const focusOnMessage = useCallback((nodeId, messageIndex) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    // Calculate message position within node
    const messageOffset = messageIndex * 120; // Approximate height per message
    const messageY = node.y + 100 + messageOffset; // 100px is base node header height

    // Center the canvas on the message
    const centerX = canvasRect.width / 2;
    const centerY = canvasRect.height / 2;

    // Calculate new translation to center the message
    const newTranslateX = centerX - (node.x + 128) * scale;
    const newTranslateY = centerY - messageY * scale;

    // Animate to new position
    setTranslate({
      x: newTranslateX,
      y: newTranslateY
    });

    // Set zoom level
    setScale(1);

    // Expand the node if it's not already expanded
    if (!expandedNodes.has(nodeId)) {
      setExpandedNodes(prev => new Set([...prev, nodeId]));
    }

    // Select the node
    setSelectedNode(nodeId);
    setFocusedMessageIndex(messageIndex);
  }, [nodes, scale, expandedNodes]);

  // Function to find connected nodes at current message
  const findConnectedNodes = useCallback((nodeId, messageIndex) => {
    const currentNode = nodes.find(n => n.id === nodeId);
    if (!currentNode) return { left: null, right: [] };

    // Find parent (left) connection
    const left = messageIndex === currentNode.parentMessageIndex ? currentNode.parentId : null;

    // Find child (right) connections
    const right = nodes
      .filter(n => n.parentId === currentNode.id && n.parentMessageIndex === messageIndex)
      .map(n => n.id);

    return { left, right };
  }, [nodes]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in input
      if (document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA') return;

      const key = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
        setPressedKeys(prev => new Set([...prev, key]));
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        setPressedKeys(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);


  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore navigation shortcuts when typing
      const isTyping = document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA';
      if (isTyping) return;

      if (!selectedNode) return;

      const currentNode = nodes.find(n => n.id === selectedNode);
      if (!currentNode) return;

      const { left, right } = findConnectedNodes(selectedNode, focusedMessageIndex);

      switch (e.key.toLowerCase()) {
        case 'w':
          if (focusedMessageIndex > 0) {
            setActiveBranchIndex(0);
            focusOnMessage(selectedNode, focusedMessageIndex - 1);
          }
          break;
        case 's':
          if (focusedMessageIndex < currentNode.messages.length - 1) {
            setActiveBranchIndex(0);
            focusOnMessage(selectedNode, focusedMessageIndex + 1);
          }
          break;
        case 'a':
          if (left) {
            const parentNode = nodes.find(n => n.id === left);
            focusOnMessage(left, parentNode.parentMessageIndex || 0);
          }
          break;
        case 'd':
          if (right.length > 0) {
            const nextBranchIndex = (activeBranchIndex + 1) % right.length;
            setActiveBranchIndex(nextBranchIndex);
            focusOnMessage(right[nextBranchIndex], 0);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, focusedMessageIndex, nodes, findConnectedNodes, focusOnMessage, activeBranchIndex]);

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

    // Add user message immediately
    const updatedMessages = [...currentNode.messages, newMessage];
    updateNodeMessages(selectedNode, updatedMessages);
    setInputValue('');
    setStreamingMessage("");
    setContinuationCount(0);
    lastResponseTime.current = Date.now();

    try {
      // Construct conversation history as a formatted prompt
      const conversationHistory = currentNode.messages
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

      console.log("Sending completion request:", {
        url: 'http://localhost:11434/api/generate',
        body: requestBody
      });

      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      console.log("Initial response status:", response.status);
      console.log("Initial response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response body:", errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      let accumulatedResponse = '';
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            console.log("Stream complete. Final accumulated response:", accumulatedResponse);
            break;
          }

          const chunk = decoder.decode(value);
          console.log("Received chunk:", chunk);

          const lines = chunk.split('\n');

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const data = JSON.parse(line);
              console.log("Parsed JSON data:", data);

              if (data.error) {
                console.error('Server returned error:', data.error);
                continue;
              }

              if (data.response !== undefined) {
                accumulatedResponse += data.response;
                setStreamingMessage(accumulatedResponse);

                // Check for continuation (pause > 0.5s)
                const now = Date.now();
                if (lastResponseTime.current && (now - lastResponseTime.current) > 500) {
                  setContinuationCount(prev => prev + 1);
                }
                lastResponseTime.current = now;
              }

              if (data.done && accumulatedResponse.trim()) {
                console.log("Received done signal. Creating assistant message.");
                const assistantMessage = {
                  role: 'assistant',
                  content: accumulatedResponse.trim(),
                  continuationCount
                };
                const finalMessages = [...updatedMessages, assistantMessage];
                updateNodeMessages(selectedNode, finalMessages);
                setStreamingMessage("");
              }
            } catch (e) {
              console.error('Error parsing JSON line:', e);
              console.error('Problematic line:', line);
            }
          }
        }
      } catch (readerError) {
        console.error('Error reading stream:', readerError);
        throw readerError;
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('Error in handleSendMessage:', error);
      setStreamingMessage(`Error: ${error.message}`);
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

    // Update the active context when creating a new branch
    const branchContext = buildConversationContext(newNode);
    setActiveContext(branchContext);

    setNodes(prevNodes => [...prevNodes, newNode]);
    setSelectedNode(newNode.id);
  };

  const updateNodeMessages = (nodeId, messages) => {
    setNodes(nodes.map(node =>
      node.id === nodeId
        ? { ...node, messages }
        : node
    ));
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
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const mainNode = nodes.find(n => n.id === 1);
    if (!mainNode) return;

    // Calculate the center position
    const centerX = canvasRect.width / 2;
    const centerY = canvasRect.height / 2;

    // Adjust translation to center the main node
    const newTranslateX = centerX - (mainNode.x + 128) * scale;
    const newTranslateY = centerY - (mainNode.y + calculateNodeHeight(mainNode, expandedNodes.has(mainNode.id)) / 2) * scale;

    setTranslate({ x: newTranslateX, y: newTranslateY });
    setScale(1); // Reset scale to default
  }, [nodes, scale, expandedNodes]);


  const organizeNodesIntoStack = useCallback(() => {
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

      // Find all children of current node
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
        x: STACK_START_X + (level * STACK_SPACING_X),
        y: STACK_START_Y + (indexAtLevel * STACK_SPACING_Y)
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
            {/* Connection arrows */}
            {nodes.map((node) => {
              const parent = nodes.find(n => n.id === node.parentId);
              if (!parent) return null;

              const source = {
                x: parent.x + 128,
                y: parent.y + (expandedNodes.has(parent.id) ? parent.messages.length * 120 + 100 : 50)
              };
              const target = {
                x: node.x,
                y: node.y + (expandedNodes.has(node.id) ? node.messages.length * 120 + 100 : 50)
              };

              return (
                <path
                  key={`connection-${node.id}`}
                  d={`M ${source.x},${source.y} C ${source.x + 100},${source.y} ${target.x - 100},${target.y} ${target.x},${target.y}`}
                  className="stroke-primary dark:stroke-primary"
                  strokeWidth="2"
                  fill="none"
                />
              );
            })}
          </svg>

          {/* Node components */}
          {nodes.map((node) => (
            <BranchNode
              key={node.id}
              node={node}
              nodes={nodes}
              isExpanded={expandedNodes.has(node.id)}
              isSelected={selectedNode === node.id}
              onToggleExpand={() => handleToggleExpand(node.id)}
              onSelect={() => setSelectedNode(node.id)}
              onDelete={() => handleDeleteNode(node.id)}
              onDragStart={handleDragStart}
              isDragging={dragState.nodeId === node.id}
              onCreateBranch={handleCreateBranch}
              selectedModel={selectedModel}
              style={{
                position: 'absolute',
                left: `${node.x}px`,
                top: `${node.y}px`,
                width: '256px',
                zIndex: selectedNode === node.id ? 10 : 1
              }}
            />
          ))}
        </div>
      </div>

      {/* Chat Sidebar */}
      <div className="absolute right-0 top-0 bottom-0 w-96 bg-background border-l border-border">
        {selectedNode && (
          <>
            <div className="flex gap-2 p-2 border-b border-border">
              <MessageNavigator
                currentNode={nodes.find(n => n.id === selectedNode)}
                currentIndex={focusedMessageIndex}
                connectedNodes={findConnectedNodes(selectedNode, focusedMessageIndex)}
                totalMessages={nodes.find(n => n.id === selectedNode)?.messages.length || 0}
              />
              <ModelStatus
                selectedModel={selectedModel}
                isLoading={isLoading}
                temperature={0.7}
              />
            </div>
            <div className="h-[calc(100%-4rem)] overflow-hidden">
              <ChatInterface
                messages={(nodes.find(n => n.id === selectedNode))?.messages || []}
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