import * as d3 from "d3";
import axios from "axios";
import React, {
    useEffect,
    useState,
    useRef,
    useMemo,
    useCallback,
    useContext,
} from "react";
import ReflectionDialog from './ReflectionDialog';
import VisualizationPanel from './VisualizationPanel';
import TopicsPanel from './TopicsPanel';
import HoverTooltip from './HoverTooltip';

const endpointColors = {
    "http://127.0.0.1:5000/api/process/status": "#FF5733", // Orange
    "http://127.0.0.1:5000/api/process": "#33FF57", // Green
    "http://127.0.0.1:8080/inference": "#3357FF", // Blue
    "http://127.0.0.1:5000/api/get-reflection": "#F39C12", // Amber
    "http://127.0.0.1:11434/api/tags": "#16A085", // Teal
    "http://127.0.0.1:11434/api/ps": "#2C3E50", // Navy
    "http://127.0.0.1:11434/api/show": "#C0392B", // Crimson
    "http://127.0.0.1:11434/api/delete": "#D35400", // Tangerine
    "http://127.0.0.1:11434/api/pull": "#1ABC9C", // Emerald
    "http://127.0.0.1:5000/api/visualization": "#9B59B6", // Violet
    "http://127.0.0.1:5000/api/states": "#34495E", // Dark Grayish Blue
    "http://127.0.0.1:5000/api/state/": "#E74C3C", // Red
    "http://localhost:11434/api/chat": "#8E44AD", // Purple
};



// Utility function for getting colors (moved outside component)
function getColor(index) {
    const colors = [
        "#60A5FA",
        "#F87171",
        "#34D399",
        "#FBBF24",
        "#A78BFA",
        "#F472B6",
        "#FB923C",
        "#2DD4BF",
        "#4ADE80",
        "#A3E635",
        "#38BDF8",
        "#FB7185",
        "#818CF8",
        "#C084FC",
        "#E879F9",
        "#22D3EE",
        "#F43F5E",
        "#10B981",
        "#6366F1",
        "#8B5CF6",
    ];
    return colors[index % colors.length];
}


const MainDashboard = ({ onConversationSelect }) => {  // Add this prop
    const [isTreeView, setIsTreeView] = useState(false);
    const [activeTab, setActiveTab] = useState("map");
    const [selectedChat, setSelectedChat] = useState(null);
    const [data, setData] = useState(null);
    const [selectedCluster, setSelectedCluster] = useState(null);
    const [selectedPoints, setSelectedPoints] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [insights, setInsights] = useState(null);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [showReflectionDialog, setShowReflectionDialog] = useState(false);
    const [hoveredPoint, setHoveredPoint] = useState(null);
    const [sortBy, setSortBy] = useState("relevance"); // 'relevance', 'size', 'coherence'
    const [filterText, setFilterText] = useState("");
    const svgRef = useRef();
    const zoomRef = useRef(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const cardRef = useRef(null);
    const nodesDataRef = useRef(null);
    const [innerWidth, setInnerWidth] = useState(0);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [currentState, setCurrentState] = useState(null);
    const [, setAvailableStates] = useState([]);
    const [isLoadingState, setIsLoadingState] = useState(false);
    const [chatType, setChatType] = useState('chatgpt');
    const [delayedCluster, setDelayedCluster] = useState(null);
    const [visualizationType, setVisualizationType] = useState('star'); // 'star' or 'islands'

    const [theme, setTheme] = useState(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("theme") || "light";
        }
        return "light";
    });

    useEffect(() => {
        document.documentElement.classList.remove('light', 'dark', 'hextech-nordic');
        document.documentElement.classList.add(theme);
        localStorage.setItem('theme', theme);
    }, [theme]);


    useEffect(() => {
        const handleResize = () => setInnerWidth(window.innerWidth);
        window.addEventListener("resize", handleResize);
        handleResize();
        return () => window.removeEventListener("resize", handleResize);
    }, []);


    const fetchMessages = async (title, chatType) => {
        const encodedTitle = encodeURIComponent(title);
        try {
            const response = await axios.get(
                `http://127.0.0.1:5000/api/messages/${encodedTitle}?type=${chatType}`,
                {
                    validateStatus: function (status) {
                        return status < 500; // Handle 404s without throwing
                    }
                }
            );
            if (response.status === 200) {
                return response.data;
            }
            return null;
        } catch (error) {
            console.error(`Error fetching with ${chatType}:`, error);
            return null;
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            if (svgRef.current) {
                // Clear existing visualization
                const svg = d3.select(svgRef.current);
                svg.selectAll("*").remove();
            }

            try {
                const response = await fetch(`http://127.0.0.1:5000/api/visualization?type=${chatType}`);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const responseData = await response.json();
                const chatsWithReflections = new Set(responseData.chats_with_reflections);

                const chartData = [{
                    id: 'points',
                    data: responseData.points.map((point, i) => ({
                        x: point[0],
                        y: point[1],
                        cluster: responseData.clusters[i],
                        title: responseData.titles[i],
                        hasReflection: chatsWithReflections.has(responseData.titles[i])
                    }))
                }];

                setData({
                    chartData,
                    topics: responseData.topics
                });

            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [chatType]);

    const url_visualization = "http://127.0.0.1:5000/api/visualization";

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === "Escape") {
                setSelectedCluster(null);
                setShowReflectionDialog(false);
                setIsSidebarOpen(false);
            }
        };

        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, []);

    const handleRefresh = async () => {
        setIsLoading(true);
        const url = `http://127.0.0.1:5000/api/visualization?type=${chatType}`;

        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseData = await response.json();

            // Validate the response data has the expected structure
            if (
                !responseData.points ||
                !responseData.clusters ||
                !responseData.titles ||
                !responseData.topics
            ) {
                throw new Error("Invalid data structure received from server");
            }

            const chatsWithReflections = new Set(
                responseData.chats_with_reflections || []
            );

            const chartData = [
                {
                    id: "points",
                    data: responseData.points.map((point, i) => ({
                        x: point[0],
                        y: point[1],
                        cluster: responseData.clusters[i],
                        title: responseData.titles[i],
                        hasReflection: chatsWithReflections.has(responseData.titles[i]),
                    })),
                },
            ];

            setData({
                chartData,
                topics: responseData.topics,
            });

            // Only reset visualization state after successful data update
            setSelectedCluster(null);
            setSelectedPoints([]);
            setHoveredPoint(null);

            // Reset zoom after a short delay to ensure data is updated
            setTimeout(() => {
                if (zoomRef.current && svgRef.current) {
                    const width = svgRef.current.clientWidth;
                    const height = svgRef.current.clientHeight;
                    const padding = 40;
                    const visWidth = width - padding;
                    const visHeight = height - padding;
                    const initialScale = 2;
                    const initialTransform = d3.zoomIdentity
                        .translate(visWidth / 2, visHeight / 2)
                        .scale(initialScale)
                        .translate(-width / 2, -height / 2);

                    d3.select(svgRef.current)
                        .transition()
                        .duration(750)
                        .call(zoomRef.current.transform, initialTransform);
                }
            }, 100);
        } catch (error) {
            console.error("Error refreshing data:", error);
            // Optionally show an error message to the user
            // You might want to add a toast or alert component for this
        } finally {
            setIsLoading(false);
        }
    };

    const toggleFullscreen = () => {
        if (!cardRef.current) return;

        if (!document.fullscreenElement) {
            cardRef.current.requestFullscreen().catch((err) => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () =>
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, [])


    useEffect(() => {
        const handleClusterSelection = async () => {
            if (selectedCluster !== null && nodesDataRef.current) {
                const topicNode = nodesDataRef.current.find(
                    (node) => node.size && node.id === selectedCluster
                );

                if (topicNode) {
                    // First set delayed cluster to null to ensure modal is hidden
                    setDelayedCluster(null);

                    // Center on the node and wait for animation to complete
                    await centerOnNode(topicNode);

                    // Add a small additional delay before showing modal
                    setTimeout(() => {
                        setDelayedCluster(selectedCluster);
                    }, 200); // Additional 200ms delay after centering completes
                }
            } else {
                setDelayedCluster(null);
            }
        };

        handleClusterSelection();
    }, [selectedCluster]);

    ;

    const handleZoomIn = () => {
        if (!zoomRef.current || !svgRef.current) return;
        d3.select(svgRef.current)
            .transition()
            .duration(300)
            .call(zoomRef.current.scaleBy, 1.7);
    };

    const handleZoomOut = () => {
        if (!zoomRef.current || !svgRef.current) return;
        d3.select(svgRef.current)
            .transition()
            .duration(300)
            .call(zoomRef.current.scaleBy, 0.45);
    };
    useEffect(() => {
        if (selectedCluster !== null && nodesDataRef.current) {
            const topicNode = nodesDataRef.current.find(
                (node) => node.size && node.id === selectedCluster
            );
            if (topicNode) {
                centerOnNode(topicNode);
            }
        }
    }, [selectedCluster]);

    // Function to center on a node with animation

    const centerOnNode = (nodeData) => {
        return new Promise((resolve) => {
            if (!zoomRef.current || !svgRef.current) {
                resolve();
                return;
            }

            const width = svgRef.current.clientWidth;
            const height = svgRef.current.clientHeight;
            const scale = 2.5;
            const x = width / 2 - nodeData.x * scale;
            const y = height / 2 - nodeData.y * scale;

            d3.select(svgRef.current)
                .transition()
                .duration(750)
                .call(
                    zoomRef.current.transform,
                    d3.zoomIdentity.translate(x, y).scale(scale)
                )
                .on("end", resolve); // Resolve promise when transition ends
        });
    };

    useEffect(() => {
        document.documentElement.classList.remove(
            "light",
            "dark",
            "hextech-nordic"
        );
        document.documentElement.classList.add(theme);
        localStorage.setItem("theme", theme);
    }, [theme]);

    const url_states = "http://127.0.0.1:5000/api/states";

    useEffect(() => {
        const fetchStates = async () => {
            try {
                const response = await fetch(`${url_states}?type=${chatType}`);
                const data = await response.json();
                setAvailableStates(data.states);
            } catch (error) {
                console.error("Error fetching states:", error);
            }
        };

        fetchStates();
    }, [chatType]);


    function createIslandsVisualization() {
        // Clear any existing visualization
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const width = svgRef.current.clientWidth;
        const height = svgRef.current.clientHeight;

        const clusters = Object.entries(data.topics).map(([id, topic]) => ({
            id: parseInt(id),
            name: topic.topic,
            size: topic.size,
            coherence: topic.coherence,
        }));

        const numClusters = clusters.length;
        const numColumns = Math.ceil(Math.sqrt(numClusters));
        const numRows = Math.ceil(numClusters / numColumns);

        const containerWidth = width / numColumns;
        const containerHeight = height / numRows;

        // Create main group
        const g = svg.append("g").attr("class", "islands");

        // For each cluster, create container
        clusters.forEach((cluster, i) => {
            const row = Math.floor(i / numColumns);
            const col = i % numColumns;

            const x = col * containerWidth;
            const y = row * containerHeight;

            // Create group for cluster
            const clusterGroup = g
                .append("g")
                .attr("transform", `translate(${x},${y})`)
                .attr("class", "cluster");

            // Add rectangle for container
            clusterGroup
                .append("rect")
                .attr("x", 10)
                .attr("y", 30) // Leave space for cluster name
                .attr("width", containerWidth - 20)
                .attr("height", containerHeight - 40)
                .attr("fill", "none")
                .attr("stroke", "#ccc")
                .attr("rx", 10) // Rounded corners
                .attr("ry", 10);

            // Add cluster name
            clusterGroup
                .append("text")
                .attr("x", (containerWidth - 20) / 2 + 10)
                .attr("y", 20)
                .attr("text-anchor", "middle")
                .attr("font-size", "14px")
                .text(cluster.name);

            // Get conversations in this cluster
            const clusterConversations = data.chartData[0].data.filter(
                (d) => d.cluster === cluster.id
            );

            // Arrange conversations inside the container
            const numConversations = clusterConversations.length;
            const convoColumns = Math.ceil(Math.sqrt(numConversations));
            const convoRows = Math.ceil(numConversations / convoColumns);

            const convoWidth = (containerWidth - 20) / convoColumns;
            const convoHeight = (containerHeight - 40) / convoRows;

            clusterConversations.forEach((convo, index) => {
                const convoRow = Math.floor(index / convoColumns);
                const convoCol = index % convoColumns;

                const convoX = convoCol * convoWidth + convoWidth / 2 + 10;
                const convoY = 30 + convoRow * convoHeight + convoHeight / 2;

                // Add circle for conversation node
                clusterGroup
                    .append("circle")
                    .attr("cx", convoX)
                    .attr("cy", convoY)
                    .attr("r", 5)
                    .attr("fill", getColor(cluster.id))
                    .attr("fill-opacity", 0.6)
                    .style("cursor", "pointer")
                    .on("mouseover", (event) => {
                        setHoveredPoint({
                            x: event.pageX,
                            y: event.pageY,
                            topic: cluster.name,
                            title: convo.title,
                            hasReflection: convo.hasReflection,
                        });
                    })
                    .on("mouseout", () => setHoveredPoint(null))
                    .on("click", (event) => {
                        event.stopPropagation();
                        handleConversationClick(
                            {
                                title: convo.title,
                                cluster: convo.cluster,
                                hasReflection: convo.hasReflection,
                            },
                            event
                        );
                    });
            });
        });

        // Implement zoom behavior
        const zoom = d3
            .zoom()
            .scaleExtent([0.5, 4])
            .on("zoom", (event) => g.attr("transform", event.transform));

        svg.call(zoom);
        zoomRef.current = zoom;

        // Adjust initial zoom to fit the islands nicely
        const initialScale = 1;
        const initialTransform = d3.zoomIdentity.scale(initialScale);
        svg.call(zoom.transform, initialTransform);
    }

    function createStarVisualization() {
        // Clear any existing visualization
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        // Add SVG defs for glow filter
        const defs = svg.append("defs");
        const filter = defs
            .append("filter")
            .attr("id", "glow")
            .attr("x", "-50%")
            .attr("y", "-50%")
            .attr("width", "200%")
            .attr("height", "200%");

        filter
            .append("feGaussianBlur")
            .attr("stdDeviation", "3")
            .attr("result", "coloredBlur");

        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode").attr("in", "coloredBlur");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");

        const width = svgRef.current.clientWidth;
        const height = svgRef.current.clientHeight;
        const centerX = width / 2;
        const centerY = height / 2;

        // Adjusted star layout parameters
        const numPoints = 5;
        const outerRadius = Math.min(width, height) / 6; // Reduced from /4 to /6
        const innerRadius = outerRadius * 0.382;

        // Expanded node placement radius (where the topic nodes will be)
        const nodeRadius = outerRadius * 1.5; // Place nodes 50% further out than the star points

        const getStarPoints = () => {
            const points = [];
            for (let i = 0; i < numPoints * 2; i++) {
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const angle = (i * Math.PI) / numPoints - Math.PI / 2;
                points.push({
                    x: centerX + radius * Math.cos(angle),
                    y: centerY + radius * Math.sin(angle),
                });
            }
            return points;
        };

        const starPoints = getStarPoints();

        // Distribute topics with more spacing
        const topics = Object.entries(data.topics).map(([id, topic], index) => {
            const pointIndex = (index % numPoints) * 2;
            const angle = (pointIndex * Math.PI) / numPoints - Math.PI / 2;
            // Place topics at nodeRadius distance from center
            return {
                id: parseInt(id),
                name: topic.topic,
                size: topic.size,
                coherence: topic.coherence,
                x: centerX + nodeRadius * Math.cos(angle),
                y: centerY + nodeRadius * Math.sin(angle),
                angle: angle,
            };
        });

        // Position chat nodes with more spacing
        const chats = data.chartData[0].data.map((d, i) => {
            const topic = topics.find((t) => t.id === d.cluster);
            const angle = topic.angle;

            // Create a wider spread for chat nodes
            const spreadDistance = nodeRadius * 0.4; // Adjust this value to control spread
            const randomAngle = angle + ((Math.random() - 0.5) * Math.PI) / 6; // Smaller angle variation
            const randomRadius = nodeRadius + (Math.random() - 0.5) * spreadDistance;

            return {
                ...d,
                id: `chat-${i}`,
                topicId: d.cluster,
                x: centerX + randomRadius * Math.cos(randomAngle),
                y: centerY + randomRadius * Math.sin(randomAngle),
            };
        });

        // Combine all nodes
        const nodes = [...topics, ...chats];
        nodesDataRef.current = nodes;

        // Create links between topics and their chats
        const links = chats.map((chat) => ({
            source: topics.find((topic) => topic.id === chat.topicId),
            target: chat,
        }));

        // Create the main container group
        const g = svg.append("g").attr("class", "clusters");

        // Draw star shape outline
        const starPath = g
            .append("path")
            .attr(
                "d",
                (() => {
                    let path = `M ${starPoints[0].x} ${starPoints[0].y}`;
                    for (let i = 1; i < starPoints.length; i++) {
                        path += ` L ${starPoints[i].x} ${starPoints[i].y}`;
                    }
                    path += " Z";
                    return path;
                })()
            )
            .attr("stroke", theme === "dark" ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)")
            .attr("fill", "none")
            .attr("stroke-width", 1.5)
            .style("filter", "none")
            .style("opacity", 0.3);

        // Create links
        const link = g
            .append("g")
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.3)
            .attr("stroke-width", 0.5);

        // Set up zoom behavior
        const zoom = d3
            .zoom()
            .scaleExtent([0.2, 8])
            .on("zoom", (event) => g.attr("transform", event.transform));

        svg.call(zoom);
        zoomRef.current = zoom;

        // Create nodes
        const node = g
            .append("g")
            .selectAll("circle")
            .data(nodes)
            .join("circle")
            .attr("r", (d) => (d.size ? 18 : 10))
            .attr("fill", (d) => {
                if (d.size) {
                    return getColor(d.id);
                } else if (d.hasReflection) {
                    return "#FFD700";
                } else {
                    return getColor(d.topicId);
                }
            })
            .attr("stroke", (d) => (d.hasReflection ? "#FFD700" : null))
            .attr("stroke-width", (d) => (d.hasReflection ? 1.5 : 0))
            .attr("fill-opacity", (d) => (d.size ? 1 : 0.6))
            .on("mouseover", (event, d) => {
                if (d.size) {
                    setHoveredPoint({
                        x: event.pageX,
                        y: event.pageY,
                        topic: data.topics[d.id].topic,
                        coherence: data.topics[d.id].coherence,
                        title: `${d.size} conversations`,
                    });
                } else {
                    setHoveredPoint({
                        x: event.pageX,
                        y: event.pageY,
                        topic: data.topics[d.topicId].topic,
                        coherence: data.topics[d.topicId].coherence,
                        title: d.title,
                        hasReflection: d.hasReflection,
                    });
                }
            })
            .on("mouseout", () => setHoveredPoint(null))
            .on("click", (event, d) => {
                event.stopPropagation();
                if (d.size) {
                    setSelectedCluster(d.id);
                } else {
                    handleConversationClick(
                        {
                            title: d.title,
                            cluster: d.topicId,
                            hasReflection: d.hasReflection,
                        },
                        event
                    );
                }
            })
            .style("cursor", "pointer");

        // Create labels with adjusted positioning
        const labels = g
            .append("g")
            .selectAll("text")
            .data(topics)
            .join("text")
            .attr("text-anchor", "middle")
            .attr("dy", "-1em")
            .attr("font-size", "10px")
            .text((d) => d.name)
            .attr("fill", theme.includes("dark") || theme.includes("nordic") || theme.includes("singed") ? "#fff" : "#000")
            .attr("opacity", 0.8)
            .style("cursor", "pointer")
            .on("click", (event, d) => {
                event.stopPropagation();
                setSelectedCluster(d.id);
            });

        // Add background click handler
        svg.on("click", () => {
            setSelectedCluster(null);
            setShowReflectionDialog(false);
        });

        // Set up force simulation with settling detection
        let isSettled = false;
        let settlingCounter = 0;
        const requiredSettledTicks = 50;

        const simulation = d3
            .forceSimulation(nodes)
            .force(
                "link",
                d3
                    .forceLink(links)
                    .id((d) => d.id)
                    .distance(30) // Increased from 20
                    .strength(0.3)
            ) // Reduced from 0.5 to allow more movement
            .force(
                "charge",
                d3.forceManyBody().strength((d) => (d.size ? -300 : -30))
            ) // Increased repulsion
            .force(
                "collide",
                d3
                    .forceCollide()
                    .radius((d) => (d.size ? 30 : 10)) // Increased collision radius
                    .strength(0.8)
            )
            .force("star", (alpha) => {
                nodes.forEach((node) => {
                    if (node.size) {
                        // Keep topic nodes at their assigned positions
                        const angle =
                            (topics.findIndex((t) => t.id === node.id) * 2 * Math.PI) /
                            numPoints -
                            Math.PI / 2;
                        const targetX = centerX + nodeRadius * Math.cos(angle);
                        const targetY = centerY + nodeRadius * Math.sin(angle);
                        node.vx += (targetX - node.x) * alpha * 0.3;
                        node.vy += (targetY - node.y) * alpha * 0.3;
                    } else {
                        // Allow chat nodes more freedom but keep them generally near their topics
                        const topic = topics.find((t) => t.id === node.topicId);
                        const angle = topic.angle + ((Math.random() - 0.5) * Math.PI) / 4;
                        const targetRadius = nodeRadius * (0.8 + Math.random() * 0.4);
                        const targetX = centerX + targetRadius * Math.cos(angle);
                        const targetY = centerY + targetRadius * Math.sin(angle);
                        node.vx += (targetX - node.x) * alpha * 0.1;
                        node.vy += (targetY - node.y) * alpha * 0.1;
                    }
                });
            });

        function ticked() {
            link
                .attr("x1", (d) => d.source.x)
                .attr("y1", (d) => d.source.y)
                .attr("x2", (d) => d.target.x)
                .attr("y2", (d) => d.target.y);

            node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);

            labels.attr("x", (d) => d.x).attr("y", (d) => d.y - 10);

            if (!isSettled) {
                const totalMovement = nodes.reduce((sum, node) => {
                    return sum + Math.sqrt((node.vx || 0) ** 2 + (node.vy || 0) ** 2);
                }, 0);

                if (totalMovement < 0.1) {
                    settlingCounter++;
                    if (settlingCounter >= requiredSettledTicks) {
                        isSettled = true;
                        starPath
                            .transition()
                            .duration(1000)
                            .style("filter", "url(#glow)")
                            .attr("stroke", "#FFD700")
                            .style("opacity", 0.8)
                            .attr("stroke-width", 2);
                    }
                } else {
                    settlingCounter = 0;
                }
            }
        }

        simulation.on("tick", ticked);

        // Adjusted initial zoom transform to account for the new layout
        const initialScale = 2;
        const padding = 40;
        const visWidth = width - padding;
        const visHeight = height - padding;
        const initialTransform = d3.zoomIdentity
            .translate(visWidth / 2, visHeight / 2)
            .scale(initialScale)
            .translate(-centerX, -centerY);

        svg.call(zoom.transform, initialTransform);

        return () => {
            simulation.stop();
            zoomRef.current = null;
            nodesDataRef.current = null;
        };
    }

    const createVisualization = useCallback(() => {
        if (!data || !svgRef.current) return;

        // Clear existing visualization
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        // Force layout recalculation by updating dimensions
        const width = svgRef.current.clientWidth;
        const height = svgRef.current.clientHeight;
        svg
            .attr("width", width)
            .attr("height", height);

        if (visualizationType === 'star') {
            createStarVisualization();
        } else if (visualizationType === 'islands') {
            createIslandsVisualization();
        }
    }, [data, theme, selectedPoints, visualizationType, chatType]);

    const handleTopicSelect = (clusterId) => {
        setSelectedCluster(parseInt(clusterId));
    };

    const handleTabChange = (value) => {
        setActiveTab(value);
        // Allow DOM to update before recreating visualization
        if (value === "map" && data) {
            setTimeout(() => {
                createVisualization();
            }, 0);
        }
    };

    const handleDataUpdate = (newData) => {
        console.log("Updating data with:", newData);
        setData(newData);

        // Trigger visualization refresh
        if (activeTab === "map") {
            setTimeout(() => {
                createVisualization();
            }, 0);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(url_visualization);
                const responseData = await response.json();
                const chatsWithReflections = new Set(
                    responseData.chats_with_reflections
                );

                const chartData = [
                    {
                        id: "points",
                        data: responseData.points.map((point, i) => ({
                            x: point[0],
                            y: point[1],
                            cluster: responseData.clusters[i],
                            title: responseData.titles[i],
                            hasReflection: chatsWithReflections.has(responseData.titles[i]),
                        })),
                    },
                ];

                setData({
                    chartData,
                    topics: responseData.topics,
                });
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        if (activeTab === "map" && data) {
            // Clear previous visualization
            if (svgRef.current) {
                const svg = d3.select(svgRef.current);
                svg.selectAll("*").remove();
            }

            createVisualization();
        }

        return () => {
            if (svgRef.current) {
                const svg = d3.select(svgRef.current);
                svg.selectAll("*").remove();
            }
        };
    }, [activeTab, data, chatType, createVisualization, visualizationType]);


    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary"></div>
            </div>
        );
    }


    const handleConversationClick = async (point, event) => {
        try {
            let clickPosition = {
                x: window.innerWidth / 2,
                y: window.innerHeight / 2
            };

            if (event?.target) {
                const rect = event.target.getBoundingClientRect();
                clickPosition = {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                };
            }

            console.log('Attempting to fetch conversation:', point.title);

            let messageData = await fetchAllMessages(point.title, 'claude');
            if (!messageData) {
                console.log('Claude fetch failed, trying ChatGPT...');
                messageData = await fetchAllMessages(point.title, 'chatgpt');
            }

            if (!messageData) {
                console.error('Failed to fetch messages with either chat type');
                return;
            }

            const branches = messageData.branches;
            const nodes = [];
            const rootNodeId = 1; // Root node ID
            const rootNode = {
                id: rootNodeId,
                title: point.title,
                messages: [],
                type: 'main',
                x: 100,
                y: 100
            };
            nodes.push(rootNode);

            // Keep track of IDs to avoid duplicates
            let nextNodeId = rootNodeId + 1;

            for (const [branchId, branchMessages] of Object.entries(branches)) {
                const formattedMessages = branchMessages.map(msg => ({
                    role: msg.sender === 'human' ? 'user' : 'assistant',
                    content: msg.text
                }));

                const node = {
                    id: nextNodeId++,
                    title: `${point.title} (Branch ${branchId})`,
                    messages: formattedMessages,
                    type: 'branch',
                    cluster: point.cluster,
                    hasReflection: point.hasReflection,
                    parentId: rootNodeId,
                    systemPrompt: '',
                    parentMessageIndex: 0,
                    branchId: branchId
                };
                nodes.push(node);
            }

            console.log('Successfully formatted conversation with branches:', nodes);

            onConversationSelect(nodes, clickPosition);

        } catch (error) {
            console.error('Error in conversation click handler:', error);
        }
    };


    const fetchAllMessages = async (title, chatType) => {
        const encodedTitle = encodeURIComponent(title);
        try {
            const response = await axios.get(
                `http://127.0.0.1:5000/api/messages_all/${encodedTitle}?type=${chatType}`,
                {
                    validateStatus: function (status) {
                        return status < 500; // Handle 404s without throwing
                    }
                }
            );
            if (response.status === 200) {
                return response.data;
            }
            return null;
        } catch (error) {
            console.error(`Error fetching with ${chatType}:`, error);
            return null;
        }
    };


    const getReflectionForChat = (chat) => {
        if (!chat || !data) return null;
        const clusterId = chat.cluster.toString();
        const reflection = data.topics[clusterId]?.reflection;
        return reflection?.replace(/<\/?antArtifact[^>]*>/g, "") || null;
    };



    return (
        <div className="flex min-h-screen bg-gradient-to-b from-background to-background/95 text-foreground">
            <main className="flex-1 ml-12 transition-all duration-300">
                <div className="mx-auto max-w-[1800px] px-6 py-10">


                    <div className="grid gap-6 lg:grid-cols-12">
                        <div className="lg:col-span-3 space-y-6">
                            <TopicsPanel
                                data={data}
                                sortBy={sortBy}
                                setSortBy={setSortBy}
                                selectedCluster={selectedCluster}
                                handleTopicSelect={handleTopicSelect}
                                getColor={getColor}
                            />
                        </div>

                        <div className="lg:col-span-9 space-y-6">
                            <VisualizationPanel
                                activeTab={activeTab}
                                handleTabChange={handleTabChange}
                                chatType={chatType}
                                setChatType={setChatType}
                                handleDataUpdate={handleDataUpdate}
                                handleRefresh={handleRefresh}
                                toggleFullscreen={toggleFullscreen}
                                handleZoomIn={handleZoomIn}
                                handleZoomOut={handleZoomOut}
                                svgRef={svgRef}
                                createVisualization={createVisualization}
                                data={data}
                                visualizationType={visualizationType}
                                setVisualizationType={setVisualizationType}
                            />
                        </div>
                    </div>

                    <ReflectionDialog
                        open={showReflectionDialog}
                        onOpenChange={setShowReflectionDialog}
                        conversation={selectedConversation}
                        reflection={selectedConversation ? getReflectionForChat(selectedConversation) : null}
                    />

                    <HoverTooltip hoveredPoint={hoveredPoint} />
                </div>
            </main>
        </div>
    );
};

export default MainDashboard;
