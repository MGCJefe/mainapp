import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}

const LazyImage: React.FC<LazyImageProps> = ({ src, alt, className = '', onLoad, onError }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '50px', // Start loading images when they're 50px from viewport
        threshold: 0.1,
      }
    );

    if (imageRef.current) {
      observer.observe(imageRef.current);
    }

    return () => {
      if (imageRef.current) {
        observer.unobserve(imageRef.current);
      }
    };
  }, []);

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  return (
    <div ref={imageRef} className={`relative ${className}`}>
      {isLoading && isVisible && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}
      
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <span className="text-sm text-gray-500">Failed to load image</span>
        </div>
      )}

      {isVisible && (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover rounded-lg ${isLoading ? 'invisible' : ''}`}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
      
      {!isVisible && (
        <div className="w-full h-full bg-gray-100 rounded-lg" />
      )}
    </div>
  );
};

export default LazyImage; 