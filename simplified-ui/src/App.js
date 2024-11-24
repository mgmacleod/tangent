import React from 'react';
import { IntegratedDashboard } from './components/IntegratedDashboard';
import VisualizationProvider from './components/VisualizationProvider';


import './styles/Global.css';

function App() {
  return (
    <div className="min-h-screen bg-background">
      <VisualizationProvider>
        <IntegratedDashboard />
      </VisualizationProvider>
    </div>
  );
}

export default App;