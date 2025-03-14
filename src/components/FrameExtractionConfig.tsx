import React from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle 
} from "@/components/ui/card";
import { Image, Sliders } from "lucide-react";

export interface FrameExtractionConfigProps {
  fps: number;
  frameCount: number;
  onFpsChange: (value: number) => void;
  onFrameCountChange: (value: number) => void;
}

const FrameExtractionConfig: React.FC<FrameExtractionConfigProps> = ({
  fps,
  frameCount,
  onFpsChange,
  onFrameCountChange,
}) => {
  // Common FPS presets
  const fpsPresets = [1, 5, 10, 15, 24, 30, 60];

  return (
    <Card className="luxury-card animate-fade-in">
      <CardHeader>
        <div className="flex items-center space-x-3">
          <div className="rounded-full bg-purple-500/10 p-2">
            <Image className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <CardTitle className="text-xl font-playfair">Frame Extraction Configuration</CardTitle>
            <CardDescription>Customize how frames are extracted from your video</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* FPS Slider */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label htmlFor="fps-slider" className="text-base font-medium">
              Frames Per Second (FPS)
            </Label>
            <span className="text-lg font-medium text-primary">{fps}</span>
          </div>
          <Slider
            id="fps-slider"
            min={1}
            max={60}
            step={1}
            value={[fps]}
            onValueChange={(values) => onFpsChange(values[0])}
            className="py-2"
          />
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>1 fps</span>
            <span>60 fps</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {fpsPresets.map((preset) => (
              <Button
                key={preset}
                variant={fps === preset ? "default" : "outline"}
                size="sm"
                onClick={() => onFpsChange(preset)}
                className="min-w-12 hover-scale"
              >
                {preset}
              </Button>
            ))}
          </div>
        </div>

        {/* Frame Count Slider */}
        <div className="space-y-4 pt-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="frame-count-slider" className="text-base font-medium">
              Number of Frames to Export
            </Label>
            <span className="text-lg font-medium text-primary">{frameCount}</span>
          </div>
          <Slider
            id="frame-count-slider"
            min={10}
            max={500}
            step={10}
            value={[frameCount]}
            onValueChange={(values) => onFrameCountChange(values[0])}
            className="py-2"
          />
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>10 frames</span>
            <span>500 frames</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {[50, 100, 200, 300, 500].map((preset) => (
              <Button
                key={preset}
                variant={frameCount === preset ? "default" : "outline"}
                size="sm"
                onClick={() => onFrameCountChange(preset)}
                className="min-w-16 hover-scale"
              >
                {preset}
              </Button>
            ))}
          </div>
        </div>

        {/* Quality Settings */}
        <div className="pt-4">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Sliders className="h-4 w-4" />
            <span>Advanced quality settings will be applied automatically</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FrameExtractionConfig; 