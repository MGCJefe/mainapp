import React, { useState, useRef } from "react";
import { Upload, X, FileVideo, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";

interface VideoUploaderProps {
  onFileSelected: (file: File) => void;
  isUploading?: boolean;
  uploadProgress?: number;
}

const VideoUploader = ({ 
  onFileSelected, 
  isUploading = false, 
  uploadProgress = 0 
}: VideoUploaderProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    // Check if the file is a video
    if (!file.type.startsWith("video/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload a video file.",
        variant: "destructive",
      });
      return;
    }
    
    // Check file size (10GB limit)
    if (file.size > 10 * 1024 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a video smaller than 10GB.",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedFile(file);
    onFileSelected(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const removeFile = () => {
    if (!isUploading) {
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="w-full">
      {!selectedFile ? (
        <div
          className={cn(
            "drop-area rounded-xl border-2 border-dashed border-border p-14 text-center transition-all subtle-shadow",
            dragActive ? "border-primary bg-primary/5" : "hover:border-primary/40"
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleChange}
            className="hidden"
          />
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="rounded-full bg-primary/10 p-5 float-animation">
              <Upload className="h-9 w-9 text-primary" />
            </div>
            <h3 className="text-xl font-playfair font-medium">Upload your video</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Drag and drop your video file here, or click to browse
            </p>
            <Button 
              onClick={handleButtonClick}
              className="mt-2 hover-scale"
              size="lg"
            >
              Select File
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Supported formats: MP4, MOV, AVI, WebM (max 10GB)
            </p>
          </div>
        </div>
      ) : (
        <div className="luxury-card p-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="rounded-full bg-primary/10 p-3">
                {isUploading ? (
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                ) : (
                  <FileVideo className="h-6 w-6 text-primary" />
                )}
              </div>
              <div className="overflow-hidden">
                <p className="font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
                {isUploading && (
                  <div className="w-full mt-2">
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Uploading: {uploadProgress}%
                    </p>
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={removeFile}
              disabled={isUploading}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoUploader;
