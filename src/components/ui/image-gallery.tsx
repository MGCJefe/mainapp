import React, { useState, useEffect } from 'react';
import { Check, Download } from 'lucide-react';
import { cn, downloadMultipleFiles } from '@/lib/utils';
import { ImageModal } from './image-modal';
import { Button } from './button';
import LazyImage from '../LazyImage';

interface ImageGalleryProps {
  images: Array<{
    id?: string;
    name: string;
    url: string;
    previewUrl?: string;
    metadata?: {
      video_id: string;
      timestamp?: number;
      qualityScore?: number;
      sharpness?: number;
      brightness?: number;
      contrast?: number;
      selected?: boolean;
    };
  }>;
  onSelect?: (frameId: string, videoId: string, isSelected: boolean) => Promise<void>;
  onDownload?: (images: Array<{ url: string; name: string }>) => void;
  selectionEnabled?: boolean;
}

export function ImageGallery({
  images,
  onSelect,
  onDownload,
  selectionEnabled = false,
}: ImageGalleryProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedImages, setSelectedImages] = useState<Record<string, boolean>>({});
  const [isSelecting, setIsSelecting] = useState(false);

  // Initialize selectedImages state from image metadata
  useEffect(() => {
    const initialSelectedState: Record<string, boolean> = {};
    
    images.forEach(image => {
      if (image.id && image.metadata?.selected) {
        initialSelectedState[image.id] = true;
      }
    });
    
    // Only update if there are selected images
    if (Object.keys(initialSelectedState).length > 0) {
      console.log('🔄 ImageGallery - Initializing selected images from metadata:', initialSelectedState);
      setSelectedImages(initialSelectedState);
    }
  }, [images]);

  const handleImageClick = (index: number, e: React.MouseEvent) => {
    const image = images[index];
    
    console.log('Image click:', {
      imageId: image.id,
      videoId: image.metadata?.video_id,
      metadata: image.metadata
    });

    if (selectionEnabled && image.id && image.metadata?.video_id && onSelect) {
      e.preventDefault();
      e.stopPropagation();
      
      // Debug log to verify the data
      console.log('Handling image selection:', {
        imageId: image.id,
        videoId: image.metadata.video_id,
        currentlySelected: selectedImages[image.id]
      });
      
      handleImageSelection(image.id, image.metadata.video_id, !selectedImages[image.id]);
    } else {
      setCurrentImageIndex(index);
      setModalOpen(true);
    }
  };

  const handleImageSelection = async (frameId: string, videoId: string, isSelected: boolean) => {
    if (!onSelect || isSelecting) return;

    // Enhanced debug logging
    console.log('🔍 ImageGallery - handleImageSelection:', {
      frameId,
      videoId,
      isSelected,
      imageData: images.find(img => img.id === frameId),
      allVideoIds: images.map(img => ({
        id: img.id,
        video_id: img.metadata?.video_id
      }))
    });

    setIsSelecting(true);
    try {
      console.log('📤 ImageGallery - Before calling onSelect:', {
        frameId,
        videoId,
        isSelected
      });
      
      await onSelect(frameId, videoId, isSelected);
      
      console.log('✅ ImageGallery - After onSelect completed successfully');
      
      // Update the selectedImages state with the new selection state
      setSelectedImages(prev => {
        const newState = {
          ...prev,
          [frameId]: isSelected
        };
        
        console.log('🔄 ImageGallery - Updated selectedImages state:', {
          previousState: prev,
          newState,
          frameId,
          isSelected
        });
        
        return newState;
      });
    } catch (error) {
      console.error('❌ ImageGallery - Error in handleImageSelection:', error);
    } finally {
      setIsSelecting(false);
    }
  };

  const handleDownload = async () => {
    if (!onDownload) return;
    
    // Add debugging to see what's in the selectedImages state
    console.log('🔍 ImageGallery - handleDownload:', {
      selectedImagesState: selectedImages,
      selectedImagesCount: Object.values(selectedImages).filter(Boolean).length,
      allImages: images.map(img => ({
        id: img.id,
        name: img.name,
        isSelected: img.id ? selectedImages[img.id] : false
      }))
    });
    
    const selectedImagesList = images.filter(img => 
      img.id && selectedImages[img.id]
    );
    
    console.log('📦 ImageGallery - Selected images for download:', {
      count: selectedImagesList.length,
      images: selectedImagesList.map(img => ({
        id: img.id,
        name: img.name
      }))
    });
    
    if (selectedImagesList.length === 0) {
      console.warn('⚠️ No images selected for download');
      return;
    }
    
    try {
      // Prepare the selected images with full URLs
      const downloadReadyImages = selectedImagesList.map(img => {
        // Ensure we're using the full URL if it's a relative path
        const fullUrl = img.url.startsWith('http') 
          ? img.url 
          : `http://localhost:8000${img.url.startsWith('/') ? img.url : `/${img.url}`}`;
        
        return {
          url: fullUrl,
          name: img.name
        };
      });
      
      // Pass to the parent component's onDownload function
      // The parent will handle the actual downloading
      onDownload(downloadReadyImages);
    } catch (error) {
      console.error('Error preparing downloads:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      {selectionEnabled && onDownload && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500">
            {Object.values(selectedImages).filter(Boolean).length} selected
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={Object.values(selectedImages).filter(Boolean).length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Download Selected
          </Button>
        </div>
      )}

      {/* Image Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image, index) => (
          <div
            key={image.id || index}
            className={cn(
              "group relative aspect-video cursor-pointer overflow-hidden rounded-lg bg-gray-100",
              "hover:ring-2 hover:ring-blue-500 hover:ring-offset-2",
              selectionEnabled && image.id && selectedImages[image.id] && "ring-2 ring-blue-500 ring-offset-2"
            )}
            onClick={(e) => handleImageClick(index, e)}
          >
            <LazyImage
              src={image.previewUrl || image.url}
              alt={image.name}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
            
            {/* Selection Overlay */}
            {selectionEnabled && (
              <div className={cn(
                "absolute inset-0 bg-black/50 transition-opacity",
                image.id && selectedImages[image.id] ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}>
                <div className="absolute right-2 top-2">
                  <div className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border-2",
                    image.id && selectedImages[image.id] ? "border-blue-500 bg-blue-500" : "border-white"
                  )}>
                    {image.id && selectedImages[image.id] && (
                      <Check className="h-4 w-4 text-white" />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Metadata Overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 transition-opacity group-hover:opacity-100">
              <p className="text-sm text-white truncate">{image.name}</p>
              {image.metadata?.qualityScore && (
                <p className="text-xs text-gray-300">
                  Quality: {(image.metadata.qualityScore * 100).toFixed(1)}%
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      <ImageModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        images={images}
        currentIndex={currentImageIndex}
        onNavigate={setCurrentImageIndex}
      />
    </div>
  );
} 