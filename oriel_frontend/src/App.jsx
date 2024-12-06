import React from 'react';
import { IntegratedDashboard } from './components/IntegratedDashboard';
import VisualizationProvider from './views/VisualizationProvider';
import OnboardingTour from './components/OnboardingTour';


import './styles/Global.css';

function App() {
  return (
    <div className="min-h-screen bg-background">
      <VisualizationProvider>
        <OnboardingTour />
        <IntegratedDashboard />
      </VisualizationProvider>
    </div>
  );
}

export default App;
