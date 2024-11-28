import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Badge } from './index';
import { Progress } from './index';
import { Input } from './ui/input';
import { Switch } from './index';
import { Label } from './index';
import { 
  ArrowRight, 
  Search, 
  SlidersHorizontal, 
  TrendingUp, 
  Users, 
  Target,
  GitBranch
} from 'lucide-react';
import { cn } from './lib/utils';

const TopicsPanel = ({
  data,
  sortBy,
  setSortBy,
  selectedCluster,
  handleTopicSelect,
  getColor
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [coherenceThreshold, setCoherenceThreshold] = useState(0);
  const [showOnlyMultiBranch, setShowOnlyMultiBranch] = useState(false);

  const sortOptions = [
    { id: 'relevance', icon: <Target className="h-4 w-4" />, label: 'Relevance' },
    { id: 'size', icon: <Users className="h-4 w-4" />, label: 'Size' },
    { id: 'coherence', icon: <TrendingUp className="h-4 w-4" />, label: 'Coherence' },
    { id: 'branches', icon: <GitBranch className="h-4 w-4" />, label: 'Branches' }
  ];

  const topicBranchCounts = useMemo(() => {
    if (!data?.chartData?.[0]?.data) return {};

    const counts = {};
    data.chartData[0].data.forEach(chat => {
      const clusterId = chat.cluster.toString();
      const baseTitle = chat.title.replace(/ \(Branch \d+\)$/, '');
      
      if (!counts[clusterId]) {
        counts[clusterId] = {
          branchMap: new Map(),
          totalBranches: 0,
          conversationsWithBranches: 0
        };
      }
      
      const branchMap = counts[clusterId].branchMap;
      if (!branchMap.has(baseTitle)) {
        branchMap.set(baseTitle, 1);
      } else {
        branchMap.set(baseTitle, branchMap.get(baseTitle) + 1);
        if (branchMap.get(baseTitle) === 2) {
          counts[clusterId].conversationsWithBranches++;
        }
        counts[clusterId].totalBranches++;
      }
    });

    return counts;
  }, [data]);

  const filteredAndSortedTopics = useMemo(() => {
    if (!data?.topics) return [];

    return Object.entries(data.topics)
      .filter(([id, topicData]) => {
        const matchesSearch = topicData.topic.toLowerCase().includes(searchQuery.toLowerCase());
        const meetsCoherence = topicData.coherence * 100 >= coherenceThreshold;
        const hasBranches = topicBranchCounts[id]?.conversationsWithBranches > 0;
        const meetsMultiBranch = !showOnlyMultiBranch || hasBranches;
        return matchesSearch && meetsCoherence && meetsMultiBranch;
      })
      .sort((a, b) => {
        const [idA, topicA] = a;
        const [idB, topicB] = b;
        const branchesA = topicBranchCounts[idA]?.totalBranches || 0;
        const branchesB = topicBranchCounts[idB]?.totalBranches || 0;

        switch (sortBy) {
          case "size":
            return topicB.size - topicA.size;
          case "coherence":
            return topicB.coherence - topicA.coherence;
          case "branches":
            return branchesB - branchesA;
          default:
            return (topicB.size * topicB.coherence) - (topicA.size * topicA.coherence);
        }
      });
  }, [data, searchQuery, sortBy, coherenceThreshold, showOnlyMultiBranch, topicBranchCounts]);

  const TopicCard = ({ cluster, topicData, isActive }) => {
    const branchInfo = topicBranchCounts[cluster];
    const hasBranches = branchInfo?.conversationsWithBranches > 0;
    const totalBranches = branchInfo?.totalBranches || 0;

    return (
      <div
        className={cn(
          "group p-4 rounded-lg transition-all duration-200",
          "hover:bg-accent/50 cursor-pointer",
          isActive && "bg-accent shadow-sm"
        )}
        onClick={() => handleTopicSelect(cluster)}
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "h-3 w-3 rounded-full mt-1.5 flex-shrink-0",
              "ring-2 ring-offset-2 ring-offset-background transition-all",
              isActive ? "ring-primary" : "ring-transparent"
            )}
            style={{ backgroundColor: getColor(parseInt(cluster)) }}
          />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium tracking-tight">{topicData.topic}</span>
              <ArrowRight
                className={cn(
                  "h-4 w-4 transition-all duration-200",
                  "opacity-0 group-hover:opacity-100 group-hover:translate-x-1"
                )}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {topicData.size}
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {(topicData.coherence * 100).toFixed(0)}%
              </span>
              {hasBranches && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  {totalBranches}
                </Badge>
              )}
            </div>

            <Progress
              value={topicData.coherence * 100}
              className={cn(
                "h-1 transition-all duration-200",
                isActive && "bg-primary/20"
              )}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="h-[700px] w-[320px] flex flex-col">
      <CardHeader className="border-b space-y-4 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle>Topics Overview</CardTitle>
          <Badge variant="outline" className="font-normal">
            {filteredAndSortedTopics.length} of {Object.keys(data?.topics || {}).length}
          </Badge>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              className={cn("shrink-0 gap-1", showFilters && "bg-accent")}
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex gap-1 flex-1 flex-wrap">
              {sortOptions.map(({ id, icon, label }) => (
                <Button
                  key={id}
                  variant={sortBy === id ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "text-xs flex items-center gap-1",
                    sortBy === id && "shadow-sm"
                  )}
                  onClick={() => setSortBy(id)}
                >
                  {icon}
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {showFilters && (
            <div className="pt-2 border-t space-y-3">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Minimum Coherence: {coherenceThreshold}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={coherenceThreshold}
                  onChange={(e) => setCoherenceThreshold(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="multi-branch-filter"
                  checked={showOnlyMultiBranch}
                  onCheckedChange={setShowOnlyMultiBranch}
                />
                <Label htmlFor="multi-branch-filter" className="text-sm text-muted-foreground">
                  Show only topics with branches
                </Label>
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredAndSortedTopics.length > 0 ? (
            filteredAndSortedTopics.map(([cluster, topicData]) => (
              <TopicCard
                key={cluster}
                cluster={cluster}
                topicData={topicData}
                isActive={parseInt(cluster) === selectedCluster}
              />
            ))
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              No topics match your criteria
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
};

export default TopicsPanel;