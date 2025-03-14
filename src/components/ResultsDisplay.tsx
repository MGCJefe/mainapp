import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Image, 
  Youtube, 
  Mail, 
  Download, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Check,
  ArrowUpDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { selectFrame, unselectFrame } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

export type ResultItem = {
  id: string;
  type: "transcript" | "frames" | "description" | "thumbnails" | "emails" | "googleDocsLink";
  title: string;
  content?: string;
  files?: Array<{
    id?: string;
    name: string;
    url: string;
    previewUrl?: string;
    metadata?: {
      timestamp?: number;
      qualityScore?: number;
      sharpness?: number;
      brightness?: number;
      contrast?: number;
      selected?: boolean;
    };
  }>;
  url?: string;
};

interface ResultsDisplayProps {
  results: ResultItem[];
}

type SortOption = "default" | "quality" | "timestamp";

const ResultsDisplay = ({ results }: ResultsDisplayProps) => {
  const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({});
  const [sortOption, setSortOption] = useState<SortOption>("default");
  const [selectedFrames, setSelectedFrames] = useState<Record<string, boolean>>({});
  const [isSelecting, setIsSelecting] = useState(false);
  const { toast } = useToast();

  // Initialize expanded state for frame results
  useEffect(() => {
    const newExpandedState = { ...expandedResults };
    results.forEach(result => {
      if (result.type === "frames" && !Object.keys(expandedResults).includes(result.id)) {
        newExpandedState[result.id] = true;
      }
    });
    setExpandedResults(newExpandedState);
  }, [results]);

  // Initialize selected frames from API data
  useEffect(() => {
    const newSelectedFrames: Record<string, boolean> = {};
    
    results.forEach(result => {
      if (result.type === "frames" && result.files) {
        result.files.forEach(file => {
          if (file.metadata?.selected && file.id) {
            newSelectedFrames[file.id] = true;
          }
        });
      }
    });
    
    setSelectedFrames(newSelectedFrames);
  }, [results]);

  const getIcon = (type: ResultItem["type"]) => {
    switch (type) {
      case "transcript":
        return <FileText className="h-5 w-5 text-blue-500" />;
      case "frames":
      case "thumbnails":
        return <Image className="h-5 w-5 text-purple-500" />;
      case "description":
        return <Youtube className="h-5 w-5 text-red-500" />;
      case "emails":
        return <Mail className="h-5 w-5 text-green-500" />;
      case "googleDocsLink":
        return <ExternalLink className="h-5 w-5 text-cyan-500" />;
    }
  };

  const toggleExpanded = (resultId: string) => {
    setExpandedResults(prev => ({
      ...prev,
      [resultId]: !prev[resultId]
    }));
  };

  const toggleFrameSelection = async (frameId: string, isSelected: boolean) => {
    if (!frameId) {
      console.error("No frame ID provided for selection toggle");
      return;
    }
    
    setIsSelecting(true);
    
    try {
      const response = isSelected 
        ? await unselectFrame(frameId)
        : await selectFrame(frameId);
      
      if (response.error) {
        toast({
          title: `Failed to ${isSelected ? 'unselect' : 'select'} frame`,
          description: response.error,
          variant: "destructive",
        });
      } else {
        setSelectedFrames(prev => ({
          ...prev,
          [frameId]: !isSelected
        }));
      }
    } catch (error) {
      console.error("Error toggling frame selection:", error);
      toast({
        title: "Error",
        description: "Failed to update frame selection",
        variant: "destructive",
      });
    } finally {
      setIsSelecting(false);
    }
  };

  const sortFiles = (files: ResultItem["files"] = []) => {
    if (sortOption === "default" || !files) return files;
    
    return [...files].sort((a, b) => {
      if (sortOption === "quality") {
        const qualityA = a.metadata?.qualityScore || 0;
        const qualityB = b.metadata?.qualityScore || 0;
        return qualityB - qualityA; // Higher quality first
      } else if (sortOption === "timestamp") {
        const timeA = a.metadata?.timestamp || 0;
        const timeB = b.metadata?.timestamp || 0;
        return timeA - timeB; // Earlier frames first
      }
      return 0;
    });
  };

  const formatTimestamp = (seconds?: number) => {
    if (seconds === undefined) return "Unknown";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const downloadSelectedFrames = () => {
    // Find all selected frames
    const framesToDownload: { url: string, name: string }[] = [];
    
    results.forEach(result => {
      if ((result.type === "frames" || result.type === "thumbnails") && result.files) {
        result.files.forEach(file => {
          if (file.id && selectedFrames[file.id] && file.url) {
            framesToDownload.push({
              url: file.url,
              name: file.name
            });
          }
        });
      }
    });
    
    if (framesToDownload.length === 0) {
      toast({
        title: "No frames selected",
        description: "Please select at least one frame to download",
        variant: "destructive",
      });
      return;
    }
    
    // For each selected frame, trigger a download
    framesToDownload.forEach(file => {
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
    
    toast({
      title: "Download started",
      description: `Downloading ${framesToDownload.length} frames`,
    });
  };

  const downloadAllFiles = (files: { name: string, url: string }[]) => {
    if (!files || files.length === 0) {
      toast({
        title: "No files to download",
        description: "There are no files available for download",
        variant: "destructive",
      });
      return;
    }
    
    // For multiple files, create a zip file
    if (files.length > 1) {
      // For now, just download them individually
      files.forEach(file => {
        const link = document.createElement('a');
        link.href = file.url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    } else {
      // For a single file, download directly
      const file = files[0];
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    
    toast({
      title: "Download started",
      description: `Downloading ${files.length} file(s)`,
    });
  };

  return (
    <div className="w-full space-y-6">
      <h3 className="text-2xl font-playfair font-medium mb-2">Processing Results</h3>
      <div className="grid gap-4">
        {results.map((result) => (
          <Collapsible
            key={result.id}
            className="luxury-card overflow-hidden transition-all duration-300"
            open={expandedResults[result.id]}
            onOpenChange={() => toggleExpanded(result.id)}
          >
            <div className="p-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-3">
                  {getIcon(result.type)}
                  <h4 className="font-medium">{result.title}</h4>
                </div>
                {(result.files || result.content || result.url) && (
                  <div className="flex items-center space-x-2">
                    {result.type !== "googleDocsLink" && result.files && result.files.length > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 hover-scale"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadAllFiles(result.files || []);
                        }}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download All
                      </Button>
                    )}
                    {expandedResults[result.id] ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                )}
              </CollapsibleTrigger>
            </div>
            
            {(result.files || result.content || result.url) && (
              <CollapsibleContent>
                <div className="px-4 pb-4 pt-1">
                  {result.content && (
                    <div className="bg-secondary/50 p-4 rounded-lg text-sm font-mono overflow-auto max-h-48">
                      <pre className="whitespace-pre-wrap">{result.content}</pre>
                    </div>
                  )}
                  
                  {result.files && result.files.length > 0 && (
                    <>
                      {(result.type === "frames" || result.type === "thumbnails") && (
                        <div className="flex justify-between items-center mb-3">
                          <div className="text-sm text-muted-foreground">
                            {Object.keys(selectedFrames).length > 0 ? (
                              <span>{Object.keys(selectedFrames).length} frames selected</span>
                            ) : (
                              <span>Click to select frames</span>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <SlidersHorizontal className="h-4 w-4 mr-2" />
                                Sort
                                <ArrowUpDown className="h-3 w-3 ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onClick={() => setSortOption("default")}
                                className={cn(sortOption === "default" && "bg-primary/10")}
                              >
                                Default Order
                                {sortOption === "default" && <Check className="h-4 w-4 ml-2" />}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setSortOption("quality")}
                                className={cn(sortOption === "quality" && "bg-primary/10")}
                              >
                                Quality Score
                                {sortOption === "quality" && <Check className="h-4 w-4 ml-2" />}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setSortOption("timestamp")}
                                className={cn(sortOption === "timestamp" && "bg-primary/10")}
                              >
                                Timestamp
                                {sortOption === "timestamp" && <Check className="h-4 w-4 ml-2" />}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                      
                      <div className={cn(
                        "grid gap-3 mt-3",
                        (result.type === "frames" || result.type === "thumbnails") 
                          ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4" 
                          : "grid-cols-1"
                      )}>
                        {sortFiles(result.files).map((file, index) => (
                          <div 
                            key={index} 
                            className={cn(
                              "relative rounded-lg border transition-all",
                              (result.type === "frames" || result.type === "thumbnails")
                                ? "aspect-video subtle-shadow" 
                                : "p-3",
                              file.id && selectedFrames[file.id] && "ring-2 ring-primary",
                              isSelecting ? "cursor-wait" : "hover-scale cursor-pointer"
                            )}
                            onClick={() => {
                              if ((result.type === "frames" || result.type === "thumbnails") && file.id) {
                                toggleFrameSelection(file.id, !!selectedFrames[file.id]);
                              }
                            }}
                          >
                            {(result.type === "frames" || result.type === "thumbnails") && file.previewUrl && (
                              <>
                                <div className="w-full h-full flex items-center justify-center overflow-hidden rounded-lg">
                                  <img 
                                    src={file.previewUrl} 
                                    alt={file.name}
                                    className="object-cover w-full h-full rounded-lg"
                                  />
                                  <a 
                                    href={file.url} 
                                    download={file.name}
                                    className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 hover:opacity-100 transition-opacity rounded-lg"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Download className="h-5 w-5" />
                                  </a>
                                </div>
                                
                                {/* Frame metadata */}
                                {file.metadata && (
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-1 text-xs rounded-b-lg">
                                    <div className="flex justify-between items-center">
                                      <span>{formatTimestamp(file.metadata.timestamp)}</span>
                                      {file.metadata.qualityScore !== undefined && (
                                        <Badge variant="outline" className="bg-primary/20 text-white border-primary/30">
                                          Q: {file.metadata.qualityScore.toFixed(1)}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Selection indicator */}
                                {file.id && selectedFrames[file.id] && (
                                  <div className="absolute top-2 right-2">
                                    <div className="bg-primary rounded-full p-1">
                                      <Check className="h-3 w-3 text-white" />
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                            
                            {!(result.type === "frames" || result.type === "thumbnails") && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm truncate">{file.name}</span>
                                <a 
                                  href={file.url} 
                                  download={file.name}
                                  className="text-primary hover:text-primary/80 transition-colors"
                                >
                                  <Download className="h-4 w-4" />
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      {(result.type === "frames" || result.type === "thumbnails") && 
                       Object.keys(selectedFrames).length > 0 && (
                        <div className="mt-4 flex justify-end">
                          <Button 
                            size="sm" 
                            className="hover-scale"
                            onClick={downloadSelectedFrames}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download Selected Frames
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                  
                  {result.url && (
                    <div className="mt-3">
                      <Button variant="outline" className="w-full hover-scale" asChild>
                        <a href={result.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open in Google Docs
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            )}
          </Collapsible>
        ))}
      </div>
    </div>
  );
};

export default ResultsDisplay;
