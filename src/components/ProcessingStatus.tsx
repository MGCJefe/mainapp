
import React from "react";
import { cn } from "@/lib/utils";

export type TaskStatus = 
  | "pending" 
  | "processing" 
  | "completed" 
  | "failed";

export type ProcessingTask = {
  id: string;
  name: string;
  status: TaskStatus;
  progress?: number;
  error?: string;
};

interface ProcessingStatusProps {
  tasks: ProcessingTask[];
  isComplete: boolean;
}

const ProcessingStatus = ({ tasks, isComplete }: ProcessingStatusProps) => {
  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case "pending":
        return (
          <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />
        );
      case "processing":
        return (
          <div className="h-4 w-4 rounded-full bg-primary animate-pulse" />
        );
      case "completed":
        return (
          <div className="h-4 w-4 rounded-full bg-green-500" />
        );
      case "failed":
        return (
          <div className="h-4 w-4 rounded-full bg-red-500" />
        );
    }
  };

  const getStatusLine = (index: number) => {
    const currentTask = tasks[index];
    const nextTask = tasks[index + 1];
    
    if (!nextTask) return null;
    
    const isActiveLine = 
      currentTask.status === "completed" && 
      (nextTask.status === "processing" || nextTask.status === "completed");
    
    const isPendingLine = 
      currentTask.status === "completed" && 
      nextTask.status === "pending";
      
    return (
      <div className="absolute left-2 top-4 bottom-0 w-[1px]">
        <div 
          className={cn(
            "w-[1px] h-full transition-all duration-500",
            isActiveLine ? "bg-green-500" : 
            isPendingLine ? "bg-muted-foreground/30" : 
            "bg-muted-foreground/30"
          )}
        />
      </div>
    );
  };

  return (
    <div className="w-full max-w-xl mx-auto luxury-card p-8">
      <h3 className="text-xl font-playfair font-medium mb-6">Processing Status</h3>
      <div className="space-y-1">
        {tasks.map((task, index) => (
          <div key={task.id} className="relative pl-8 pb-6">
            {getStatusLine(index)}
            <div className="absolute left-0 top-0">
              {getStatusIcon(task.status)}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{task.name}</h4>
                <span className="text-xs text-muted-foreground capitalize">
                  {task.status}
                </span>
              </div>
              
              {task.status === "processing" && task.progress !== undefined && (
                <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-primary h-full rounded-full transition-all"
                    style={{ width: `${task.progress}%` }} 
                  />
                </div>
              )}
              
              {task.status === "failed" && task.error && (
                <p className="text-sm text-red-500">{task.error}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {isComplete && (
        <div className="mt-6 text-center text-green-600 animate-fade-in">
          All tasks completed successfully!
        </div>
      )}
    </div>
  );
};

export default ProcessingStatus;
