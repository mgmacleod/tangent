import React from 'react';
import * as d3 from "d3";
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Card, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Sparkles, ChartBarIcon, RefreshCw, Maximize2, Plus, Minus } from 'lucide-react';
import { ChatTypeSelector, VisualizationTypeSelector } from './TypeSelector';
import ExploreTab from './ExploreTab';

const VisualizationPanel = ({
  activeTab,
  handleTabChange,
  chatType,
  setChatType,
  handleDataUpdate,
  handleRefresh,
  toggleFullscreen,
  handleZoomIn,
  handleZoomOut,
  svgRef,
  createVisualization,
  data,
  visualizationType,
  setVisualizationType,
}) => {
  React.useEffect(() => {
    if (activeTab === "map" && data && svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();
      
      setTimeout(() => {
        createVisualization();
      }, 100);
    }
  }, [activeTab, data, chatType, visualizationType, createVisualization]);

  return (
    <Card className="overflow-hidden h-[700px]">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="h-full flex flex-col">
        <CardHeader className="border-b pb-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="map" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Map
              </TabsTrigger>
              <TabsTrigger value="explore" className="gap-2">
                <ChartBarIcon className="h-4 w-4" />
                Explore
              </TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <VisualizationTypeSelector
                visualizationType={visualizationType}
                setVisualizationType={setVisualizationType}
              />
              <ChatTypeSelector
                chatType={chatType}
                setChatType={setChatType}
                onDataUpdate={handleDataUpdate}
              />
              <Button variant="ghost" size="sm" className="gap-2" onClick={handleRefresh}>
                <RefreshCw className="h-3 w-3" />
                Refresh
              </Button>
              <Button variant="ghost" size="sm" className="gap-2" onClick={toggleFullscreen}>
                <Maximize2 className="h-3 w-3" />
                Expand
              </Button>
            </div>
          </div>
        </CardHeader>

        <div className="flex-1 relative overflow-hidden">
          <TabsContent value="map" className="absolute inset-0">
            <div className="h-full">
              <svg ref={svgRef} className="h-full w-full" style={{ background: "transparent" }} />
              <div className="absolute bottom-4 right-4 flex gap-2">
                <Button size="sm" variant="secondary" className="gap-2" onClick={handleZoomOut}>
                  <Minus className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="secondary" className="gap-2" onClick={handleZoomIn}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="explore" className="absolute inset-0">
            <ExploreTab />
          </TabsContent>
        </div>
      </Tabs>
    </Card>
  );
};

export default VisualizationPanel;