import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, MessageCircle, GitMerge } from 'lucide-react';

const ConversationFlowVis = ({ data }) => {
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);

  // Process data to create tree structure
  const treeData = useMemo(() => {
    if (!data) return null;
    
    // Create nodes map
    const nodesMap = new Map();
    const childrenMap = new Map();
    
    // First pass - create nodes
    data.forEach(msg => {
      nodesMap.set(msg.id, {
        ...msg,
        children: [],
        level: 0,
        x: 0,
        y: 0
      });
      
      // Track parent-child relationships
      if (msg.parentId) {
        if (!childrenMap.has(msg.parentId)) {
          childrenMap.set(msg.parentId, []);
        }
        childrenMap.get(msg.parentId).push(msg.id);
      }
    });
    
    // Second pass - build tree structure
    childrenMap.forEach((children, parentId) => {
      const parent = nodesMap.get(parentId);
      if (parent) {
        children.forEach(childId => {
          const child = nodesMap.get(childId);
          if (child) {
            parent.children.push(child);
            child.level = parent.level + 1;
          }
        });
      }
    });
    
    // Calculate positions
    const root = Array.from(nodesMap.values()).find(node => !node.parentId);
    if (!root) return null;
    
    const NODE_WIDTH = 200;
    const NODE_HEIGHT = 100;
    const LEVEL_GAP = 120;
    
    const positionNode = (node, x = 0, y = 0) => {
      node.x = x;
      node.y = y;
      
      // Position children
      const totalChildren = node.children.length;
      const childrenWidth = totalChildren * NODE_WIDTH;
      let startX = x - (childrenWidth / 2);
      
      node.children.forEach((child, index) => {
        positionNode(
          child,
          startX + (index * NODE_WIDTH) + (NODE_WIDTH / 2),
          y + LEVEL_GAP
        );
      });
    };
    
    positionNode(root);
    return root;
  }, [data]);

  // Render connections between nodes
  const renderConnections = useCallback((node) => {
    if (!node.children.length) return null;
    
    return node.children.map(child => {
      const path = `M ${node.x},${node.y + 30} 
                    C ${node.x},${node.y + 60}
                      ${child.x},${child.y - 30}
                      ${child.x},${child.y - 30}`;
                      
      return (
        <motion.path
          key={`${node.id}-${child.id}`}
          d={path}
          stroke={child.branchId === selectedBranch ? '#3b82f6' : '#e2e8f0'}
          strokeWidth="2"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5 }}
        />
      );
    });
  }, [selectedBranch]);

  const renderNode = useCallback((node) => {
    const isActive = node.branchId === selectedBranch;
    const isHovered = hoveredNode?.id === node.id;
    
    return (
      <g key={node.id}>
        {/* Render connections */}
        {renderConnections(node)}
        
        {/* Render node */}
        <motion.g
          transform={`translate(${node.x - 60},${node.y - 30})`}
          onMouseEnter={() => setHoveredNode(node)}
          onMouseLeave={() => setHoveredNode(null)}
          onClick={() => setSelectedBranch(node.branchId)}
          whileHover={{ scale: 1.05 }}
          style={{ cursor: 'pointer' }}
        >
          {/* Node background */}
          <motion.rect
            width="120"
            height="60"
            rx="8"
            fill={isActive ? '#3b82f6' : '#ffffff'}
            stroke={isHovered ? '#3b82f6' : '#e2e8f0'}
            strokeWidth="2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          
          {/* Branch indicator */}
          {node.children.length > 0 && (
            <motion.g transform="translate(85, 10)">
              <GitBranch 
                size={16} 
                color={isActive ? '#ffffff' : '#94a3b8'}
              />
            </motion.g>
          )}
          
          {/* Message count */}
          <text
            x="60"
            y="35"
            textAnchor="middle"
            fill={isActive ? '#ffffff' : '#1e293b'}
            fontSize="14"
            fontWeight={isActive ? 'bold' : 'normal'}
          >
            {node.messages.length} messages
          </text>
        </motion.g>
        
        {/* Recursively render children */}
        {node.children.map(child => renderNode(child))}
      </g>
    );
  }, [selectedBranch, hoveredNode, renderConnections]);

  if (!treeData) return null;

  return (
    <div className="w-full h-full overflow-hidden bg-gray-50">
      <svg
        width="100%"
        height="100%"
        viewBox="-500 -50 1000 600"
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform="translate(500,50)">
          {renderNode(treeData)}
        </g>
      </svg>
      
      {/* Branch info panel */}
      <AnimatePresence>
        {hoveredNode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-md"
          >
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="w-4 h-4 text-gray-500" />
              <span className="font-medium">Branch {hoveredNode.branchId}</span>
            </div>
            <div className="text-sm text-gray-600">
              {hoveredNode.messages.length} messages in this branch
              {hoveredNode.children.length > 0 && (
                <span className="ml-2">
                  • {hoveredNode.children.length} sub-branches
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ConversationFlowVis;