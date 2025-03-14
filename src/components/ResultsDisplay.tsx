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
import { ImageGallery } from "@/components/ui/image-gallery";
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
import { selectFrame, unselectFrame, debugVideoMetadata } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import LazyImage from "./LazyImage";
import { downloadFile, downloadMultipleFiles } from "@/lib/utils";

export type ResultItem = {
  id: string;  // This is the video_id for frame results
  type: "transcript" | "frames" | "description" | "thumbnails" | "emails" | "googleDocsLink";
  title: string;
  content?: string;
  files?: Array<{
    id?: string;
    name: string;
    url: string;
    previewUrl?: string;
    metadata?: {
      video_id?: string;
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

  // Debug logging for results and video_ids
  useEffect(() => {
    results.forEach(result => {
      if (result.type === "frames" || result.type === "thumbnails") {
        console.log('ResultsDisplay - Processing result:', {
          resultId: result.id,
          resultType: result.type,
          filesCount: result.files?.length || 0
        });
        
        result.files?.forEach(file => {
          console.log('ResultsDisplay - File metadata:', {
            fileId: file.id,
            fileName: file.name,
            originalVideoId: file.metadata?.video_id,
            assignedVideoId: result.id
          });
        });
      }
    });
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

  const toggleFrameSelection = async (frameId: string, videoId: string, isSelected: boolean) => {
    if (!frameId || !videoId) {
      console.error("Missing frame ID or video ID for selection toggle", { frameId, videoId });
      return;
    }

    // Enhanced debug logging
    console.log('🔍 Toggle frame selection - BEFORE API CALL:', { 
      frameId, 
      videoId, 
      isSelected,
      endpoint: isSelected ? '/api/frames/unselect' : '/api/frames/select',
      requestBody: JSON.stringify({
        video_id: videoId,
        frame_ids: [frameId]
      }, null, 2)
    });

    setIsSelecting(true);
    
    try {
      const endpoint = isSelected ? '/api/frames/unselect' : '/api/frames/select';
      
      // Log the exact request being made
      const requestBody = {
        video_id: videoId,
        frame_ids: [frameId]
      };
      
      console.log('📤 API Request:', {
        url: `http://localhost:8000${endpoint}`,
        method: 'POST',
        body: requestBody
      });
      
      const response = await fetch(`http://localhost:8000${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      // Log response status
      console.log('📥 API Response Status:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error response:', errorText);
        
        // Try to parse the error as JSON for more details
        try {
          const errorData = JSON.parse(errorText);
          console.error('❌ Parsed error data:', errorData);
          
          // Check if there's any information about the video_id in the error
          if (errorData.detail && typeof errorData.detail === 'string' && 
              errorData.detail.includes('video_id')) {
            console.error('❌ Possible video_id issue in error message:', {
              providedVideoId: videoId,
              errorMessage: errorData.detail
            });
          }
          
          const errorMessage = errorData.detail || errorData.message || `Error: ${response.status}`;
          toast({
            title: `Failed to ${isSelected ? 'unselect' : 'select'} frame`,
            description: errorMessage,
            variant: "destructive",
          });
        } catch (e) {
          console.error('❌ Could not parse error response as JSON:', e);
          toast({
            title: `Failed to ${isSelected ? 'unselect' : 'select'} frame`,
            description: `Server error: ${response.status}`,
            variant: "destructive",
          });
        }
        return;
      }

      setSelectedFrames(prev => ({
        ...prev,
        [frameId]: isSelected
      }));

      // Add debug log to confirm the state update
      console.log('✅ Updated selectedFrames state:', {
        frameId,
        newSelectionState: isSelected,
        updatedState: {
          ...selectedFrames,
          [frameId]: isSelected
        }
      });

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

  const downloadSelectedFrames = async (selectedImagesFromGallery?: Array<{ url: string; name: string }>) => {
    try {
      // If we received selected images directly from the gallery, use those
      if (selectedImagesFromGallery && selectedImagesFromGallery.length > 0) {
        console.log('📦 ResultsDisplay - Using selected images from gallery:', {
          count: selectedImagesFromGallery.length,
          images: selectedImagesFromGallery
        });
        
        // Use the new utility function to download multiple files
        await downloadMultipleFiles(selectedImagesFromGallery);
        
        toast({
          title: "Download started",
          description: `Downloading ${selectedImagesFromGallery.length} frames`,
        });
        
        return;
      }
      
      // Otherwise, use our internal selectedFrames state
      console.log('🔍 ResultsDisplay - downloadSelectedFrames:', {
        selectedFramesState: selectedFrames,
        selectedFramesCount: Object.values(selectedFrames).filter(Boolean).length
      });
      
      // Find all selected frames
      const framesToDownload: { url: string, name: string }[] = [];
      
      results.forEach(result => {
        if ((result.type === "frames" || result.type === "thumbnails") && result.files) {
          result.files.forEach(file => {
            if (file.id && selectedFrames[file.id] && file.url) {
              console.log('✅ Found selected frame:', {
                fileId: file.id,
                fileName: file.name,
                isSelected: selectedFrames[file.id],
                url: file.url
              });
              
              // Ensure we're using the full URL if it's a relative path
              const fullUrl = file.url.startsWith('http') 
                ? file.url 
                : `http://localhost:8000${file.url.startsWith('/') ? file.url : `/${file.url}`}`;
              
              framesToDownload.push({
                url: fullUrl,
                name: file.name
              });
            }
          });
        }
      });
      
      console.log('📦 ResultsDisplay - Frames to download:', {
        count: framesToDownload.length,
        frames: framesToDownload
      });
      
      if (framesToDownload.length === 0) {
        toast({
          title: "No frames selected",
          description: "Please select at least one frame to download",
          variant: "destructive",
        });
        return;
      }
      
      // Use the new utility function to download multiple files
      await downloadMultipleFiles(framesToDownload);
      
      toast({
        title: "Download started",
        description: `Downloading ${framesToDownload.length} frames`,
      });
    } catch (error) {
      console.error('Error downloading selected frames:', error);
      toast({
        title: "Download Error",
        description: `Failed to download frames: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const downloadAllFiles = async (files: { name: string, url: string }[]) => {
    if (!files || files.length === 0) {
      toast({
        title: "No files to download",
        description: "There are no files available for download",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Prepare files with full URLs
      const filesToDownload = files.map(file => {
        // Ensure we're using the full URL if it's a relative path
        const fullUrl = file.url.startsWith('http') 
          ? file.url 
          : `http://localhost:8000${file.url.startsWith('/') ? file.url : `/${file.url}`}`;
        
        return {
          url: fullUrl,
          name: file.name
        };
      });
      
      // Use the new utility function to download multiple files
      await downloadMultipleFiles(filesToDownload);
      
      toast({
        title: "Download started",
        description: `Downloading ${files.length} file(s)`,
      });
    } catch (error) {
      console.error('Error downloading files:', error);
      toast({
        title: "Download Error",
        description: `Failed to download files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  // Debug function to check metadata for a result
  const debugResultMetadata = async (resultId: string) => {
    console.log('Debugging metadata for result:', resultId);
    
    try {
      const response = await debugVideoMetadata(resultId);
      
      console.log('Debug metadata response:', response);
      
      if (response.error) {
        toast({
          title: "Debug Error",
          description: response.error,
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Debug Info",
        description: `Metadata check complete. See console for details.`,
      });
    } catch (error) {
      console.error('Error in debug function:', error);
      toast({
        title: "Debug Error",
        description: String(error),
        variant: "destructive",
      });
    }
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
                        onClick={async (e) => {
                          e.stopPropagation();
                          await downloadAllFiles(result.files || []);
                        }}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download All
                      </Button>
                    )}
                    {(result.type === "frames" || result.type === "thumbnails") && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 hover-scale ml-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          debugResultMetadata(result.id);
                        }}
                      >
                        Debug Metadata
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
                      
                      {(result.type === "frames" || result.type === "thumbnails") ? (
                        <>
                          <ImageGallery
                            images={sortFiles(result.files).map(file => {
                              return {
                                ...file,
                                metadata: {
                                  ...file.metadata,
                                  video_id: result.id
                                }
                              };
                            })}
                            onSelect={toggleFrameSelection}
                            onDownload={downloadSelectedFrames}
                            selectionEnabled={true}
                          />
                        </>
                      ) : (
                        <div className="grid grid-cols-1 gap-3">
                          {sortFiles(result.files).map((file, index) => (
                            <div 
                              key={file.id || `file-${index}`}
                              className="relative rounded-lg border p-3 transition-all"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm truncate">{file.name}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-primary hover:text-primary/80 transition-colors"
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    
                                    // Ensure we're using the full URL if it's a relative path
                                    const fullUrl = file.url.startsWith('http') 
                                      ? file.url 
                                      : `http://localhost:8000${file.url.startsWith('/') ? file.url : `/${file.url}`}`;
                                    
                                    try {
                                      await downloadFile(fullUrl, file.name);
                                      toast({
                                        title: "Download started",
                                        description: `Downloading ${file.name}`,
                                      });
                                    } catch (error) {
                                      console.error('Error downloading file:', error);
                                      toast({
                                        title: "Download Error",
                                        description: `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`,
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  
                  {result.url && result.type === "googleDocsLink" && (
                    <div className="flex justify-end">
                      <a 
                        href={result.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-2 text-primary hover:text-primary/80 transition-colors"
                      >
                        <span>Open in Google Docs</span>
                        <ExternalLink className="h-4 w-4" />
                      </a>
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
