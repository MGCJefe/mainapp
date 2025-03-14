import React, { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: Array<{
    url: string;
    name: string;
    metadata?: {
      timestamp?: number;
      qualityScore?: number;
    };
  }>;
  currentIndex: number;
  onNavigate: (newIndex: number) => void;
}

export function ImageModal({
  isOpen,
  onClose,
  images,
  currentIndex,
  onNavigate,
}: ImageModalProps) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (currentIndex > 0) {
            onNavigate(currentIndex - 1);
          }
          break;
        case 'ArrowRight':
          if (currentIndex < images.length - 1) {
            onNavigate(currentIndex + 1);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, images.length, onClose, onNavigate]);

  if (!isOpen) return null;

  const currentImage = images[currentIndex];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div 
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -right-4 -top-4 rounded-full bg-white p-1 text-gray-800 shadow-lg hover:bg-gray-200"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Navigation buttons */}
        {currentIndex > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(currentIndex - 1);
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 text-gray-800 shadow-lg hover:bg-white"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        
        {currentIndex < images.length - 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(currentIndex + 1);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 text-gray-800 shadow-lg hover:bg-white"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {/* Image */}
        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-white"></div>
            </div>
          )}
          <img
            src={currentImage.url}
            alt={currentImage.name}
            className={cn(
              "max-h-[90vh] max-w-[90vw] rounded-lg",
              isLoading ? "opacity-0" : "opacity-100"
            )}
            onLoad={() => setIsLoading(false)}
          />
        </div>

        {/* Image info */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-4 text-white">
          <p className="text-sm">{currentImage.name}</p>
          <p className="text-xs text-gray-300">
            {currentIndex + 1} of {images.length}
            {currentImage.metadata?.qualityScore && 
              ` • Quality: ${(currentImage.metadata.qualityScore * 100).toFixed(1)}%`}
          </p>
        </div>
      </div>
    </div>
  );
} 