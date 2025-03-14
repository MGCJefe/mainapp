
import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type Task = {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
};

interface TaskSelectorProps {
  tasks: Task[];
  selectedTasks: string[];
  onChange: (taskIds: string[]) => void;
}

const TaskSelector = ({ tasks, selectedTasks, onChange }: TaskSelectorProps) => {
  const toggleTask = (taskId: string) => {
    if (selectedTasks.includes(taskId)) {
      onChange(selectedTasks.filter(id => id !== taskId));
    } else {
      onChange([...selectedTasks, taskId]);
    }
  };

  return (
    <div className="w-full space-y-4">
      <h3 className="text-xl font-playfair font-medium mb-4">Select processing tasks</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={cn(
              "relative rounded-xl border p-5 cursor-pointer transition-all hover-scale subtle-shadow",
              selectedTasks.includes(task.id)
                ? "border-primary/30 bg-primary/5"
                : "border-border hover:border-primary/20"
            )}
            onClick={() => toggleTask(task.id)}
          >
            <div className="flex items-start space-x-3">
              <div className="mt-0.5">{task.icon}</div>
              <div className="flex-1">
                <h4 className="font-medium">{task.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {task.description}
                </p>
              </div>
              <div 
                className={cn(
                  "w-5 h-5 rounded-full border flex items-center justify-center transition-all",
                  selectedTasks.includes(task.id)
                    ? "border-primary bg-primary text-white"
                    : "border-muted-foreground"
                )}
              >
                {selectedTasks.includes(task.id) && (
                  <Check className="h-3 w-3" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskSelector;
