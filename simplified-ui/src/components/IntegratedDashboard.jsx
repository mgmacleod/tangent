import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import MainDashboard from './MainDashboard';
import TangentChat from './TangentChat';
import TangentLogo from './TangentLogo';
import FileUploader from './FileUploader';
import { Button } from './ui/button';
import { Share2, Download, ArrowLeft, Plus, Bot } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { useVisualization } from './VisualizationProvider';
import ModelsModal from './ModelsModal';

const SharedHeader = ({
  handleRefresh,
  theme,
  setTheme,
  currentView,
  handleBack,
  onNewThread,
  lastConversation,
  onManageModels
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md shadow-md">
      <div className="w-full mx-auto px-8 py-4 relative flex items-center">
        {/* Left section */}
        <div className="flex-1 flex items-center justify-start space-x-4">
          {currentView === 'conversation' && (
            <Button
              variant="ghost"
              className="p-2"
              onClick={handleBack}
              aria-label="Go Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Center section - Logo */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <TangentLogo />
        </div>

        {/* Right section */}
        <div className="flex-1 flex items-center justify-end space-x-4">
          <Button
            variant="outline"
            size="icon"
            onClick={onManageModels}
            className="h-8 w-8"
            aria-label="Manage Models"
          >
            <Bot className="h-4 w-4" />
          </Button>
          <ThemeToggle theme={theme} setTheme={setTheme} />
          <FileUploader onProcessingComplete={handleRefresh} />
          <Button variant="outline" className="gap-2">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <Button
            onClick={onNewThread}
            variant="default"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New Thread
          </Button>
        </div>
      </div>
    </header>
  );
};

export const SharedHeaderWrapper = ({ onNewThread, onManageModels }) => {  // Add prop
  const { handleRefresh, theme, setTheme, view, setView } = useVisualization();
  const [lastConversation, setLastConversation] = useState(null);

  const handleBack = useCallback((conversation = null) => {
    if (conversation) {
      setView('conversation');
      setLastConversation(conversation);
    } else {
      setView('clusters');
    }
  }, [setView]);

  return (
    <SharedHeader
      handleRefresh={handleRefresh}
      theme={theme}
      setTheme={setTheme}
      currentView={view}
      handleBack={handleBack}
      onNewThread={onNewThread}
      lastConversation={lastConversation}
      onManageModels={onManageModels}  // Pass it through
    />
  );
};


export const IntegratedDashboard = () => {
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [selectedNodePosition, setSelectedNodePosition] = useState(null);
  const [view, setView] = useState('clusters');
  const [lastThread, setLastThread] = useState(null);
  const { handleRefresh, theme, setTheme } = useVisualization();

  // Models modal state
  const [showModelsModal, setShowModelsModal] = useState(false);
  const [localModels, setLocalModels] = useState([]);
  const [runningModels, setRunningModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [pullModelName, setPullModelName] = useState("");
  const [isPulling, setIsPulling] = useState(false);
  const [pullStatus, setPullStatus] = useState("");
  const [detailedView, setDetailedView] = useState(false);

  // Fetch models on mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('http://localhost:11434/api/tags');
        const data = await response.json();
        setLocalModels(data.models);
      } catch (error) {
        console.error('Error fetching models:', error);
      }
    };

    const fetchRunningModels = async () => {
      try {
        const response = await fetch('http://localhost:11434/api/ps');
        const data = await response.json();
        setRunningModels(data.models || []);
      } catch (error) {
        console.error('Error fetching running models:', error);
      }
    };

    fetchModels();
    fetchRunningModels();
    const interval = setInterval(fetchRunningModels, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleModelClick = async (modelName) => {
    try {
      const response = await fetch("http://localhost:11434/api/show", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: modelName }),
      });
      const data = await response.json();
      setSelectedModel(modelName);
      setModelInfo(data);
    } catch (error) {
      console.error("Error fetching model info:", error);
    }
  };

  const handleDeleteModel = async (modelName) => {
    if (!window.confirm(`Are you sure you want to delete model "${modelName}"?`)) return;
    try {
      await fetch("http://localhost:11434/api/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelName }),
      });

      // Refresh models list after deletion
      const response = await fetch('http://localhost:11434/api/tags');
      const data = await response.json();
      setLocalModels(data.models);
    } catch (error) {
      console.error("Error deleting model:", error);
    }
  };

  const handlePullModel = async () => {
    if (!pullModelName.trim()) {
      alert("Please enter a model name");
      return;
    }

    setIsPulling(true);
    setPullStatus("Starting download...");

    try {
      const response = await fetch("http://localhost:11434/api/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: pullModelName.trim(), stream: false }),
      });

      if (!response.ok) throw new Error("Failed to pull model");

      setPullStatus("Model downloaded successfully");
      setPullModelName("");

      // Refresh models list after pulling new model
      const tagsResponse = await fetch('http://localhost:11434/api/tags');
      const data = await tagsResponse.json();
      setLocalModels(data.models);
    } catch (error) {
      console.error("Error pulling model:", error);
      setPullStatus(`Error: ${error.message}`);
    } finally {
      setIsPulling(false);
    }
  };

  const handleManageModels = useCallback(() => {
    setShowModelsModal(true);
  }, []);


  const handleNewThread = useCallback(() => {
    const newConversation = [{  // Changed to array of nodes
      id: Date.now(),
      messages: [],
      type: 'main',
      title: 'Main Thread',
      x: window.innerWidth / 4,
      y: window.innerHeight / 3,
      branchId: '0'
    }, {
      id: Date.now() + 1,
      messages: [],
      type: 'branch',
      title: 'New Thread',
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      parentId: Date.now(),
      systemPrompt: '',
      parentMessageIndex: 0,
      branchId: '0.0'
    }];

    setSelectedConversation(newConversation);
    setLastThread(newConversation);
    setSelectedNodePosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    });
    setView('conversation');
  }, []);

  const handleConversationSelect = useCallback((nodes, position) => {
    // Ensure nodes have proper branch IDs
    const processedNodes = nodes.map((node, index) => ({
      ...node,
      branchId: node.branchId || `${index}`,
      // Ensure x/y coordinates are valid numbers
      x: typeof node.x === 'number' ? node.x : position?.x || window.innerWidth / 2,
      y: typeof node.y === 'number' ? node.y : position?.y || window.innerHeight / 2
    }));

    setSelectedConversation(processedNodes);
    setLastThread(processedNodes);
    setSelectedNodePosition(position || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    });
    setView('conversation');
  }, []);
  const handleBack = useCallback(() => {
    setView('clusters');
  }, []);



  // Inside IntegratedDashboard.jsx return statement
  return (
    <LayoutGroup>
      <div className="fixed inset-0 flex flex-col bg-background">
        <SharedHeader
          handleRefresh={handleRefresh}
          theme={theme}
          setTheme={setTheme}
          currentView={view}
          handleBack={() => setView('clusters')}
          onNewThread={handleNewThread}
          lastConversation={lastThread}
          onManageModels={handleManageModels}
        />

        <ModelsModal
          isOpen={showModelsModal}
          onClose={() => setShowModelsModal(false)}
          models={localModels}
          runningModels={runningModels}
          detailedView={detailedView}
          setDetailedView={setDetailedView}
          onModelClick={handleModelClick}
          onDeleteModel={handleDeleteModel}
          pullModelName={pullModelName}
          setPullModelName={setPullModelName}
          isPulling={isPulling}
          onPullModel={handlePullModel}
          pullStatus={pullStatus}
          modelInfo={modelInfo}
          selectedModel={selectedModel}
        />
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              {view === 'conversation' ? (
                <motion.div
                  key="conversation"
                  className="absolute inset-1"
                  initial={{
                    opacity: 0,
                    scale: 0.8,
                    x: selectedNodePosition?.x ? selectedNodePosition.x - window.innerWidth / 2 : 0,
                    y: selectedNodePosition?.y ? selectedNodePosition.y - window.innerHeight / 2 : 0
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    x: 0,
                    y: 0,
                    transition: {
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                      mass: 0.8
                    }
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.8,
                    x: selectedNodePosition?.x ? selectedNodePosition.x - window.innerWidth / 2 : 0,
                    y: selectedNodePosition?.y ? selectedNodePosition.y - window.innerHeight / 2 : 0
                  }}
                >
                  <TangentChat
                    initialConversation={selectedConversation}
                    selectedNodePosition={selectedNodePosition}
                    onBack={() => setView('clusters')}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="dashboard"
                  className="absolute  top-16 right-16 inset-1"
                  initial={{ opacity: 0, x: "-100%" }}
                  animate={{
                    opacity: 1,
                    x: "0%",
                    transition: {
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                      mass: 0.8
                    }
                  }}
                  exit={{ opacity: 0, x: "-100%" }}
                >
                  <MainDashboard
                    onConversationSelect={handleConversationSelect}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </LayoutGroup>
  );
};
export default IntegratedDashboard;