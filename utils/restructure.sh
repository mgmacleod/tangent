#!/bin/bash

# Base directory
BASE_DIR="src/components"

# Create main component directories
mkdir -p "$BASE_DIR"/{core,feedback,layout,navigation,overlay,visualization,chat,forms,shared,providers}

# Move components to their respective directories
# Core components
mv "$BASE_DIR"/Card.jsx "$BASE_DIR"/core/
mv "$BASE_DIR"/ModelCard.jsx "$BASE_DIR"/core/

# Chat components
mv "$BASE_DIR"/ChatContainer.jsx "$BASE_DIR"/chat/
mv "$BASE_DIR"/ChatInterface.jsx "$BASE_DIR"/chat/
mv "$BASE_DIR"/ChatMessage.jsx "$BASE_DIR"/chat/
mv "$BASE_DIR"/ChatPersistanceManager.jsx "$BASE_DIR"/chat/
mv "$BASE_DIR"/ChatUI.jsx "$BASE_DIR"/chat/
mv "$BASE_DIR"/TangentChat.jsx "$BASE_DIR"/chat/

# Visualization components
mv "$BASE_DIR"/AudioVisualizer.jsx "$BASE_DIR"/visualization/
mv "$BASE_DIR"/BranchNode.jsx "$BASE_DIR"/visualization/
mv "$BASE_DIR"/VisualizationPanel.jsx "$BASE_DIR"/visualization/
mv "$BASE_DIR"/ConversationFlowVis.jsx "$BASE_DIR"/visualization/
mv "$BASE_DIR"/MainDashboard.jsx "$BASE_DIR"/visualization/
mv "$BASE_DIR"/TopicsPanel.jsx "$BASE_DIR"/visualization/

# Navigation components
mv "$BASE_DIR"/MessageNavigator.jsx "$BASE_DIR"/navigation/
mv "$BASE_DIR"/CanvasToolbar.jsx "$BASE_DIR"/navigation/

# Shared components
mv "$BASE_DIR"/FloatingInput.jsx "$BASE_DIR"/shared/
mv "$BASE_DIR"/TangentLogo.jsx "$BASE_DIR"/shared/
mv "$BASE_DIR"/ThemeToggle.jsx "$BASE_DIR"/shared/
mv "$BASE_DIR"/ModelStatus.jsx "$BASE_DIR"/shared/
mv "$BASE_DIR"/TypeSelector.jsx "$BASE_DIR"/shared/

# Feedback components
mv "$BASE_DIR"/HoverTooltip.jsx "$BASE_DIR"/feedback/
mv "$BASE_DIR"/ReflectionDialog.jsx "$BASE_DIR"/feedback/

# Forms components
mv "$BASE_DIR"/FileUploader.jsx "$BASE_DIR"/forms/
mv "$BASE_DIR"/RecordingButton.jsx "$BASE_DIR"/forms/

# Move modals to overlay
mv "$BASE_DIR"/ModelsModal.jsx "$BASE_DIR"/overlay/
mv "$BASE_DIR"/OnboardingTour.jsx "$BASE_DIR"/overlay/

# Move providers
mv "$BASE_DIR"/VisualizationProvider.jsx "$BASE_DIR"/providers/

# Move IntegratedDashboard and ExploreTab to layout
mv "$BASE_DIR"/IntegratedDashboard.jsx "$BASE_DIR"/layout/
mv "$BASE_DIR"/ExploreTab.jsx "$BASE_DIR"/layout/

# Move UI components to core
mv "$BASE_DIR"/ui/* "$BASE_DIR"/core/
rmdir "$BASE_DIR"/ui

# Move lib to utils
mkdir -p src/utils
mv "$BASE_DIR"/lib/* src/utils/
rmdir "$BASE_DIR"/lib

echo "Component organization complete!"