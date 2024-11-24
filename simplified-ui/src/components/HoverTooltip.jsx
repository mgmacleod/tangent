
// HoverTooltip.jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const HoverTooltip = ({ hoveredPoint }) => {
  if (!hoveredPoint) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 5 }}
        transition={{ duration: 0.2 }}
        className="fixed pointer-events-none z-50 bg-popover/95 backdrop-blur-sm border rounded-lg shadow-lg p-4"
        style={{
          left: hoveredPoint.x + 15,
          top: hoveredPoint.y - 15,
          transform: "translate(-50%, -100%)",
          maxWidth: "320px",
        }}
      >
        <div className="space-y-2">
          <div className="font-semibold">{hoveredPoint.topic}</div>
          <div className="text-sm text-muted-foreground">{hoveredPoint.title}</div>
          <div className="flex items-center gap-2">
            <div className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {(hoveredPoint.coherence * 100).toFixed(0)}% coherent
            </div>
            {hoveredPoint.hasReflection && (
              <div className="text-xs bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full">
                Has Reflection
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default HoverTooltip;