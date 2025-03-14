import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Image, 
  Youtube, 
  Mail, 
  Sparkles, 
  Upload,
  RefreshCw,
  CheckCircle2,
  Wifi,
  WifiOff,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import VideoUploader from "@/components/VideoUploader";
import TaskSelector, { Task } from "@/components/TaskSelector";
import ProcessingStatus, { ProcessingTask, TaskStatus } from "@/components/ProcessingStatus";
import ResultsDisplay, { ResultItem } from "@/components/ResultsDisplay";
import FrameExtractionConfig from "@/components/FrameExtractionConfig";
import { 
  checkApiHealth, 
  uploadVideo, 
  VideoMetadata,
  FrameExtractionConfig as FrameExtractionConfigType,
  startFrameExtraction,
  getFrameExtractionStatus,
  getExtractedFrames,
  FrameExtractionTask,
  FrameMetadata
} from "@/lib/api";
import api from '../lib/api';

// Mock tasks for demo purposes
const AVAILABLE_TASKS: Task[] = [
  {
    id: "transcription",
    name: "Transcription",
    description: "Convert video audio to text using Whisper AI.",
    icon: <FileText className="h-5 w-5 text-blue-500" />,
  },
  {
    id: "frame-extraction",
    name: "Frame Extraction",
    description: "Extract high-quality frames based on motion & contrast.",
    icon: <Image className="h-5 w-5 text-purple-500" />,
  },
  {
    id: "description",
    name: "YouTube Description",
    description: "Generate SEO-optimized descriptions with timestamps.",
    icon: <Youtube className="h-5 w-5 text-red-500" />,
  },
  {
    id: "thumbnails",
    name: "Thumbnail Sketches",
    description: "AI-generated rule-of-thirds thumbnail mockups.",
    icon: <Sparkles className="h-5 w-5 text-amber-500" />,
  },
  {
    id: "emails",
    name: "Email Variations",
    description: "Generate 3 email variations based on video content.",
    icon: <Mail className="h-5 w-5 text-green-500" />,
  },
];

enum ProcessingStage {
  Upload = "upload",
  Uploading = "uploading",
  TaskSelection = "task-selection",
  TaskConfiguration = "task-configuration",
  Processing = "processing",
  Results = "results",
}

const Index = () => {
  const [stage, setStage] = useState<ProcessingStage>(ProcessingStage.Upload);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [processingTasks, setProcessingTasks] = useState<ProcessingTask[]>([]);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [isProcessingComplete, setIsProcessingComplete] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoData, setVideoData] = useState<VideoMetadata | null>(null);
  
  // Task tracking
  const [activeTasks, setActiveTasks] = useState<Record<string, string>>({});
  const [processingProgress, setProcessingProgress] = useState<Record<string, number>>({});
  
  // Frame extraction configuration
  const [frameExtractionConfig, setFrameExtractionConfig] = useState<FrameExtractionConfigType>({
    fps: 24,
    frame_count: 100,
    quality_threshold: 0.5,
    parallel_processing: true,
  });
  
  const { toast } = useToast();

  // Add API health check
  useEffect(() => {
    const checkBackendStatus = async () => {
      try {
        const response = await checkApiHealth();
        if (response.data && response.data.status === 'ok') {
          setApiStatus('connected');
        } else {
          setApiStatus('error');
          console.error('API health check failed:', response.error);
        }
      } catch (error) {
        setApiStatus('error');
        console.error('API connection error:', error);
      }
    };
    
    checkBackendStatus();
    // Poll every 30 seconds to ensure connection
    const interval = setInterval(checkBackendStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Poll for task status updates
  useEffect(() => {
    if (stage !== ProcessingStage.Processing || Object.keys(activeTasks).length === 0) {
      return;
    }

    const pollTaskStatus = async () => {
      const allComplete = await updateTaskStatuses();
      
      if (allComplete) {
        setIsProcessingComplete(true);
        await fetchResults();
        setStage(ProcessingStage.Results);
      }
    };

    const intervalId = setInterval(pollTaskStatus, 2000);
    return () => clearInterval(intervalId);
  }, [stage, activeTasks]);

  const updateTaskStatuses = async () => {
    let allComplete = true;
    
    for (const [taskId, taskType] of Object.entries(activeTasks)) {
      if (taskType === "frame-extraction") {
        try {
          const response = await getFrameExtractionStatus(taskId);
          
          if (response.error) {
            console.error(`Error fetching task status: ${response.error}`);
            continue;
          }
          
          if (response.data) {
            const task = response.data;
            const updatedTasks = [...processingTasks];
            const taskIndex = updatedTasks.findIndex(t => t.id === "frame-extraction");
            
            if (taskIndex !== -1) {
              updatedTasks[taskIndex] = {
                ...updatedTasks[taskIndex],
                status: task.status as TaskStatus,
                progress: task.progress || 0
              };
              
              if (task.status === "processing") {
                allComplete = false;
              } else if (task.status === "failed") {
                updatedTasks[taskIndex] = {
                  ...updatedTasks[taskIndex],
                  error: "Frame extraction failed"
                };
              }
              
              setProcessingTasks(updatedTasks);
              setProcessingProgress(prev => ({
                ...prev,
                [taskId]: task.progress || 0
              }));
            }
          }
        } catch (error) {
          console.error("Error updating task status:", error);
        }
      } else {
        // For other task types, we would add similar status checking
        // For now, we'll just simulate them completing after frame extraction
        allComplete = false;
      }
    }
    
    return allComplete;
  };

  const fetchResults = async () => {
    const newResults: ResultItem[] = [];
    
    // Fetch frame extraction results if that task was selected
    if (selectedTasks.includes("frame-extraction") && videoData) {
      try {
        const response = await getExtractedFrames(videoData.id);
        
        console.log("=== Frame Extraction Debug ===");
        console.log("Video ID:", videoData.id);
        console.log("Raw API Response:", response);
        console.log("Response.data contents:", JSON.stringify(response.data, null, 2));
        
        if (response.error) {
          console.error("API Error:", response.error);
          toast({
            title: "Error fetching frames",
            description: response.error,
            variant: "destructive",
          });
        } else if (response.data) {
          // The API returns { video_id, frames_count, frames }
          const framesData = response.data.frames;
          
          console.log("Response data structure:", {
            responseType: typeof response.data,
            dataKeys: Object.keys(response.data),
            framesCount: response.data.frames_count,
            framesArrayLength: framesData?.length,
            firstFrame: framesData?.[0]
          });
          
          // Safely handle frames data
          const frames = Array.isArray(framesData) ? framesData : [];
          if (frames.length === 0) {
            console.log("No frames received from API");
            toast({
              title: "No frames found",
              description: "The video processing completed but no frames were returned.",
              variant: "destructive",
            });
            return;
          }
          
          // Convert API frame data to result format
          const frameFiles = frames.map(frame => {
            if (!frame) {
              console.warn("Received null or undefined frame");
              return null;
            }
            
            console.log("Processing frame:", {
              id: frame.frame_id,
              paths: {
                file_path: frame.file_path,
                file_url: frame.file_url,
                thumbnail_path: frame.thumbnail_path,
                thumbnail_url: frame.thumbnail_url
              }
            });
            
            const resultItem = {
              id: frame.frame_id,
              name: frame.filename || `frame_${frame.frame_id}.jpg`,
              url: frame.file_url || frame.file_path,
              previewUrl: frame.thumbnail_url || frame.thumbnail_path,
              metadata: {
                timestamp: frame.timestamp,
                qualityScore: frame.metrics?.quality_score,
                sharpness: frame.metrics?.sharpness,
                brightness: frame.metrics?.brightness,
                contrast: frame.metrics?.contrast,
                selected: frame.selected
              }
            };
            
            return resultItem;
          }).filter(Boolean); // Remove any null items
          
          if (frameFiles.length === 0) {
            console.warn("No valid frames after processing");
            toast({
              title: "Processing Error",
              description: "Could not process any frames from the response.",
              variant: "destructive",
            });
            return;
          }
          
          console.log("Final processed frames:", {
            count: frameFiles.length,
            firstFrame: frameFiles[0]
          });
          
          // CRITICAL FIX: Use the actual video_id from the API response instead of hardcoded "frames-result"
          // This was causing the 500 error when trying to update frame selection
          const videoId = response.data.video_id || videoData.id;
          
          console.log("🔍 IMPORTANT - Setting video_id for frames:", {
            apiResponseVideoId: response.data.video_id,
            videoDataId: videoData.id,
            finalVideoId: videoId,
            previousHardcodedId: "frames-result" // This was the problem!
          });
          
          newResults.push({
            id: videoId, // Use the correct video_id here instead of hardcoded "frames-result"
            type: "frames",
            title: `Extracted Key Frames (${frameExtractionConfig.fps} FPS)`,
            files: frameFiles.map(file => ({
              ...file,
              metadata: {
                ...file.metadata,
                video_id: videoId // Ensure video_id is set in metadata too
              }
            }))
          });
        }
      } catch (error) {
        console.error("Error fetching frame results:", error);
      }
    }
    
    // For other task types, we would add similar result fetching
    // For now, we'll just use mock data for them
    if (selectedTasks.includes("transcription")) {
      newResults.push({
            id: "transcript-result",
            type: "transcript",
            title: "Video Transcript",
            content: "This is a sample transcript of the video content. It would include all spoken words and timestamps.\n\n[00:00:05] Introduction to the topic\n[00:01:23] Key points discussed\n[00:03:45] Summary and conclusion",
            files: [
              {
                name: "transcript.txt",
                url: "#"
              },
              {
                name: "transcript.srt",
                url: "#"
              }
            ]
          });
    }
    
    if (selectedTasks.includes("description")) {
      newResults.push({
            id: "description-result",
            type: "description",
            title: "YouTube Description",
            content: "🔹 Ultimate Guide to Video Processing with AI\n\nIn this video, we explore the cutting-edge techniques for processing video content using artificial intelligence.\n\nTIMESTAMPS:\n00:00 Introduction\n01:23 Key Techniques Explained\n03:45 Practical Applications\n05:10 Future Developments\n\n#VideoProcessing #AI #MachineLearning",
            files: [
              {
                name: "youtube_description.txt",
                url: "#"
              }
            ]
          });
    }
    
    if (selectedTasks.includes("thumbnails")) {
      newResults.push({
            id: "thumbnails-result",
            type: "thumbnails",
            title: "AI-Generated Thumbnails",
            files: Array(4).fill(0).map((_, i) => ({
              name: `thumbnail_${i+1}.jpg`,
              url: "#",
              previewUrl: "https://placehold.co/400x225"
            }))
          });
    }
    
    if (selectedTasks.includes("emails")) {
      newResults.push({
            id: "emails-result",
            type: "emails",
            title: "Email Variations",
            content: "EMAIL VARIATION 1:\nSubject: Just Released: Essential Video Processing Techniques\n\nHello,\n\nI've just published a new video covering essential techniques for video processing with AI. This comprehensive guide shows you how to...\n\n---\n\nEMAIL VARIATION 2:\nSubject: [New Tutorial] Transform Your Video Workflow with AI\n\nHi there,\n\nExcited to share my latest tutorial that will help you revolutionize your video processing workflow using artificial intelligence...",
            files: [
              {
                name: "email_variations.txt",
                url: "#"
              }
            ]
          });
          
      newResults.push({
            id: "googledocs-result",
            type: "googleDocsLink",
            title: "Google Docs Link",
            url: "https://docs.google.com/document/d/example"
          });
    }
    
    setResults(newResults);
  };

  const handleFileSelected = async (file: File) => {
    setSelectedFile(file);
    setStage(ProcessingStage.Uploading);
    setUploadProgress(0);

    try {
      console.log("Uploading file:", file.name, "Size:", file.size);
      const response = await uploadVideo(file, (progress) => {
        setUploadProgress(progress);
      });

      if (response.error) {
        console.error("Upload failed with error:", response.error);
        toast({
          title: "Upload Failed",
          description: response.error,
          variant: "destructive",
        });
        setStage(ProcessingStage.Upload);
        setSelectedFile(null);
        return;
      }

      if (response.data) {
        console.log("Upload successful. Video data:", response.data);
        console.log("Video ID:", response.data.id);
        setVideoData(response.data);
        toast({
          title: "Upload Successful",
          description: "Your video has been uploaded successfully.",
        });
        setStage(ProcessingStage.TaskSelection);
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: "An unexpected error occurred during upload.",
        variant: "destructive",
      });
      setStage(ProcessingStage.Upload);
      setSelectedFile(null);
    }
  };

  const handleTasksSelected = (taskIds: string[]) => {
    setSelectedTasks(taskIds);
  };

  const handleFpsChange = (value: number) => {
    setFrameExtractionConfig(prev => ({
      ...prev,
      fps: value
    }));
  };

  const handleFrameCountChange = (value: number) => {
    setFrameExtractionConfig(prev => ({
      ...prev,
      frame_count: value
    }));
  };

  const proceedToConfiguration = () => {
    if (selectedTasks.length === 0) {
      toast({
        title: "No tasks selected",
        description: "Please select at least one processing task.",
        variant: "destructive",
      });
      return;
    }

    // If frame extraction is selected, show configuration
    if (selectedTasks.includes("frame-extraction")) {
      setStage(ProcessingStage.TaskConfiguration);
    } else {
      // If no configuration needed, proceed directly to processing
      startProcessing();
    }
  };

  const startProcessing = async () => {
    if (!videoData) {
      toast({
        title: "Error",
        description: "No video data available. Please upload a video first.",
        variant: "destructive",
      });
      return;
    }
    
    console.log("Starting processing with video data:", videoData);
    console.log("Video ID for frame extraction:", videoData.id);
    console.log("Frame extraction config:", frameExtractionConfig);
    
    setStage(ProcessingStage.Processing);
    setIsProcessingComplete(false);
    setActiveTasks({});
    
    // Debug the video ID
    if (videoData?.id) {
      console.log("Debugging video ID:", videoData.id);
      const debugResult = await api.debugVideoId(videoData.id);
      console.log("Debug result:", debugResult);
    }
    
    // Create processing tasks based on selected tasks
    const tasks: ProcessingTask[] = selectedTasks.map(taskId => {
      const task = AVAILABLE_TASKS.find(t => t.id === taskId);
      return {
        id: taskId,
        name: task?.name || "",
        status: "pending",
        error: undefined
      };
    });
    
    setProcessingTasks(tasks);
    
    // Start each selected task
    for (const taskId of selectedTasks) {
      if (taskId === "frame-extraction") {
        try {
          console.log("Starting frame extraction for video ID:", videoData.id);
          const response = await startFrameExtraction(videoData.id, frameExtractionConfig);
          
          if (response.error) {
            console.error("Frame extraction failed with error:", response.error);
            toast({
              title: "Frame Extraction Failed",
              description: response.error,
              variant: "destructive",
            });
            
            // Update task status
            const taskIndex = processingTasks.findIndex(t => t.id === "frame-extraction");
            if (taskIndex !== -1) {
              const updatedTasks = [...processingTasks];
              updatedTasks[taskIndex] = {
                ...updatedTasks[taskIndex],
                status: "failed" as TaskStatus,
                error: response.error
              };
              setProcessingTasks(updatedTasks);
            }
          } else if (response.data) {
            console.log("Frame extraction task created:", response.data);
            console.log("Task ID:", response.data.task_id);
            // Store the task ID for status polling
            setActiveTasks(prev => ({
              ...prev,
              [response.data.task_id]: "frame-extraction"
            }));
            
            // Update task status to processing
            const updatedTasks = [...tasks];
            const taskIndex = updatedTasks.findIndex(t => t.id === "frame-extraction");
            if (taskIndex !== -1) {
              updatedTasks[taskIndex] = {
                ...updatedTasks[taskIndex],
                status: "processing" as TaskStatus
              };
              setProcessingTasks(updatedTasks);
            }
          }
        } catch (error) {
          console.error("Error starting frame extraction:", error);
          
          // Update task status to failed
          const updatedTasks = [...tasks];
          const taskIndex = updatedTasks.findIndex(t => t.id === "frame-extraction");
          if (taskIndex !== -1) {
            updatedTasks[taskIndex] = {
              ...updatedTasks[taskIndex],
              status: "failed" as TaskStatus,
              error: "An unexpected error occurred"
            };
            setProcessingTasks(updatedTasks);
          }
        }
      }
      
      // For other task types, we would add similar API calls
      // For now, we'll just simulate them
      if (taskId !== "frame-extraction") {
        simulateOtherTask(taskId, tasks);
      }
    }
  };

  const simulateOtherTask = (taskId: string, allTasks: ProcessingTask[]) => {
    // Find the task in the list
    const taskIndex = allTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;
    
    // Update task status to processing
    const updatedTasks = [...allTasks];
    updatedTasks[taskIndex] = {
      ...updatedTasks[taskIndex],
      status: "processing" as TaskStatus
    };
    setProcessingTasks(updatedTasks);
    
    // Simulate progress updates
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 5;
      
      const progressTasks = [...updatedTasks];
      progressTasks[taskIndex] = {
        ...progressTasks[taskIndex],
        progress
      };
      setProcessingTasks([...progressTasks]);
      
      if (progress >= 100) {
        clearInterval(progressInterval);
        const completedTasks = [...progressTasks];
        completedTasks[taskIndex] = {
          ...completedTasks[taskIndex],
          status: "completed" as TaskStatus
        };
        setProcessingTasks([...completedTasks]);
      }
    }, 500);
  };

  const resetApp = () => {
    setSelectedFile(null);
    setSelectedTasks([]);
    setProcessingTasks([]);
    setResults([]);
    setIsProcessingComplete(false);
    setVideoData(null);
    setUploadProgress(0);
    setActiveTasks({});
    setProcessingProgress({});
    setStage(ProcessingStage.Upload);
    // Reset frame extraction config to defaults
    setFrameExtractionConfig({
      fps: 24,
      frame_count: 100,
      quality_threshold: 0.5,
      parallel_processing: true,
    });
  };

  const renderStageContent = () => {
    switch (stage) {
      case ProcessingStage.Upload:
        return (
          <div className="max-w-2xl mx-auto w-full">
            <VideoUploader onFileSelected={handleFileSelected} />
          </div>
        );
      
      case ProcessingStage.Uploading:
        return (
          <div className="max-w-2xl mx-auto w-full">
            <VideoUploader 
              onFileSelected={handleFileSelected} 
              isUploading={true} 
              uploadProgress={uploadProgress} 
            />
          </div>
        );
      
      case ProcessingStage.TaskSelection:
        return (
          <div className="max-w-3xl mx-auto w-full space-y-8">
            <div className="luxury-card p-6 animate-fade-in">
              <div className="flex items-center space-x-4">
                <div className="rounded-full bg-primary/10 p-3">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div className="overflow-hidden">
                  <p className="font-medium">{selectedFile?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Ready to process
                  </p>
                </div>
              </div>
            </div>
            
            <TaskSelector 
              tasks={AVAILABLE_TASKS}
              selectedTasks={selectedTasks}
              onChange={handleTasksSelected}
            />
            
            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={resetApp}>
                Cancel
              </Button>
              <Button onClick={proceedToConfiguration} className="hover-scale">
                {selectedTasks.includes("frame-extraction") ? "Configure Tasks" : "Start Processing"}
              </Button>
            </div>
          </div>
        );
      
      case ProcessingStage.TaskConfiguration:
        return (
          <div className="max-w-3xl mx-auto w-full space-y-8">
            <div className="luxury-card p-6 animate-fade-in">
              <div className="flex items-center space-x-4">
                <div className="rounded-full bg-primary/10 p-3">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div className="overflow-hidden">
                  <p className="font-medium">{selectedFile?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Configure processing options
                  </p>
                </div>
              </div>
            </div>
            
            {selectedTasks.includes("frame-extraction") && (
              <FrameExtractionConfig 
                fps={frameExtractionConfig.fps}
                frameCount={frameExtractionConfig.frame_count}
                onFpsChange={handleFpsChange}
                onFrameCountChange={handleFrameCountChange}
              />
            )}
            
            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setStage(ProcessingStage.TaskSelection)}>
                Back
              </Button>
              <Button onClick={startProcessing} className="hover-scale">
                Start Processing
              </Button>
            </div>
          </div>
        );
      
      case ProcessingStage.Processing:
        return (
          <div className="max-w-3xl mx-auto w-full space-y-8">
            <div className="flex items-center justify-center">
              <div className="animate-pulse text-primary">
                <RefreshCw className="h-8 w-8 animate-spin" />
              </div>
            </div>
            
            <ProcessingStatus 
              tasks={processingTasks}
              isComplete={isProcessingComplete}
            />
          </div>
        );
      
      case ProcessingStage.Results:
        return (
          <div className="max-w-4xl mx-auto w-full space-y-8">
            <div className="flex items-center justify-center space-x-2 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              <p className="text-lg font-medium">Processing Complete</p>
            </div>
            
            <ResultsDisplay results={results} />
            
            <div className="flex justify-center pt-4">
              <Button onClick={resetApp} className="hover-scale">
                Process Another Video
              </Button>
            </div>
          </div>
        );
    }
  };

  const getStageTitle = () => {
    switch (stage) {
      case ProcessingStage.Upload:
        return "Upload Your Video";
      case ProcessingStage.Uploading:
        return "Uploading Your Video";
      case ProcessingStage.TaskSelection:
        return "Select Processing Tasks";
      case ProcessingStage.TaskConfiguration:
        return "Configure Processing Options";
      case ProcessingStage.Processing:
        return "Processing Your Video";
      case ProcessingStage.Results:
        return "Processing Results";
    }
  };

  return (
    <div className="container py-8 max-w-5xl mx-auto min-h-screen flex flex-col">
      {/* API Status Indicator */}
      <div className="flex justify-end mb-4">
        <div className="flex items-center space-x-2 text-sm">
          <span className="text-muted-foreground">API Status:</span>
          {apiStatus === 'connected' ? (
            <div className="flex items-center text-green-500">
              <Wifi className="h-4 w-4 mr-1" />
              <span>Connected</span>
            </div>
          ) : apiStatus === 'error' ? (
            <div className="flex items-center text-red-500">
              <WifiOff className="h-4 w-4 mr-1" />
              <span>Disconnected</span>
            </div>
          ) : (
            <div className="flex items-center text-yellow-500">
              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              <span>Checking...</span>
          </div>
          )}
        </div>
      </div>
      
      <h1 className="text-4xl font-playfair font-bold tracking-tight mb-2">
        ClipCraft
      </h1>
      <p className="text-xl text-muted-foreground mb-8">
        Transform your videos with AI
      </p>
      
      <main className="flex-1 luxury-gradient">
        <div className="container mx-auto py-12 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12 animate-fade-in">
              <h2 className="text-4xl font-playfair font-bold mb-3">{getStageTitle()}</h2>
              {stage === ProcessingStage.Upload && (
                <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
                  Upload your video, select processing tasks, and let our system handle the rest.
                </p>
              )}
              {stage === ProcessingStage.TaskConfiguration && (
                <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
                  Customize how your video will be processed before starting.
                </p>
              )}
            </div>
            
            <div className="mt-8 animate-fade-in">
              {renderStageContent()}
            </div>
          </div>
        </div>
      </main>
      
      <footer className="border-t bg-white py-8">
        <div className="container mx-auto px-4">
          <p className="text-center text-sm text-muted-foreground">
            Video Processor — A streamlined solution for video content processing
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
