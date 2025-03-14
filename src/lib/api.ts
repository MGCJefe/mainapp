/**
 * API Client for ClipCraft Backend
 */

const API_BASE_URL = 'http://localhost:8000/api';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface VideoMetadata {
  id: string;
  filename: string;
  original_filename?: string;
  upload_time: string;
  size: number;
  status: string;
}

export interface FrameExtractionConfig {
  fps: number;
  frame_count: number;
  quality_threshold?: number;
  parallel_processing?: boolean;
}

export interface FrameExtractionTask {
  task_id: string;
  video_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  config: FrameExtractionConfig;
  created_at: string;
}

export interface FrameMetadata {
  id?: string;
  frame_id: string;
  video_id: string;
  filename?: string;
  timestamp: number;
  timestamp_formatted?: string;
  metrics?: {
    quality_score: number;
    sharpness: number;
    brightness: number;
    contrast: number;
  };
  quality_score?: number; // For backward compatibility
  sharpness?: number; // For backward compatibility
  brightness?: number; // For backward compatibility
  contrast?: number; // For backward compatibility
  selected: boolean;
  thumbnail_url?: string;
  full_image_url?: string;
  file_url?: string;
  thumbnail_path?: string;
  file_path?: string;
}

export interface FramesListResponse {
  video_id: string;
  frames_count: number;
  frames: FrameMetadata[];
}

/**
 * Generic fetch wrapper with error handling
 */
async function fetchApi<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log(`API Request: ${options.method || 'GET'} ${url}`, options.body ? JSON.parse(options.body as string) : '');
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: `HTTP error! status: ${response.status}`,
      }));
      
      console.error(`API Error (${endpoint}):`, errorData);
      return { 
        error: errorData.detail || errorData.message || `API error: ${response.status}` 
      };
    }

    const data = await response.json();
    console.log(`API Response (${endpoint}):`, data);
    return { data };
  } catch (error) {
    console.error(`API error (${endpoint}):`, error);
    return { 
      error: error instanceof Error ? error.message : 'Unknown API error' 
    };
  }
}

/**
 * Health check endpoint to verify API connection
 */
export async function checkApiHealth() {
  return fetchApi<{ status: string; service: string; timestamp: number; system: any }>('/health');
}

/**
 * Upload a video file to the backend
 * Returns video metadata and reports upload progress
 */
export async function uploadVideo(file: File, onProgress?: (progress: number) => void): Promise<ApiResponse<VideoMetadata>> {
  try {
    console.log("Starting video upload for file:", file.name, "Size:", file.size);
    // Create a FormData object to send the file
    const formData = new FormData();
    formData.append('file', file);
    
    // Use XMLHttpRequest to track upload progress
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Set up upload progress event
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      });
      
      // Set up load event (successful completion)
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            console.log("Upload successful. Response:", data);
            resolve({ data });
          } catch (e) {
            console.error("Error parsing upload response:", e);
            resolve({ error: 'Invalid response from server' });
          }
        } else {
          let errorMessage = 'Upload failed';
          try {
            const errorData = JSON.parse(xhr.responseText);
            errorMessage = errorData.detail || errorData.message || `Upload failed: ${xhr.status}`;
            console.error("Upload failed. Error:", errorData);
          } catch (e) {
            console.error("Upload failed. Status:", xhr.status);
            // If we can't parse the error, use a generic message
          }
          resolve({ error: errorMessage });
        }
      });
      
      // Set up error event
      xhr.addEventListener('error', () => {
        console.error("Network error during upload");
        resolve({ error: 'Network error during upload' });
      });
      
      // Set up abort event
      xhr.addEventListener('abort', () => {
        console.warn("Upload canceled");
        resolve({ error: 'Upload canceled' });
      });
      
      // Open and send the request
      const uploadUrl = `${API_BASE_URL}/videos/upload`;
      console.log("Sending upload request to:", uploadUrl);
      xhr.open('POST', uploadUrl);
      xhr.send(formData);
    });
  } catch (error) {
    console.error('Error during video upload:', error);
    return { 
      error: error instanceof Error ? error.message : 'Unknown upload error' 
    };
  }
}

/**
 * Delete a video by ID
 */
export async function deleteVideo(videoId: string): Promise<ApiResponse<{ message: string }>> {
  return fetchApi<{ message: string }>(`/videos/${videoId}`, {
    method: 'DELETE',
  });
}

/**
 * Start a frame extraction task with the given configuration
 */
export async function startFrameExtraction(
  videoId: string, 
  config: FrameExtractionConfig
): Promise<ApiResponse<FrameExtractionTask>> {
  console.log("Starting frame extraction for video ID:", videoId, "Config:", config);
  return fetchApi<FrameExtractionTask>(`/frames/extract`, {
    method: 'POST',
    body: JSON.stringify({
      video_id: videoId,
      ...config
    }),
  });
}

/**
 * Get the status of a frame extraction task
 */
export async function getFrameExtractionStatus(
  taskId: string
): Promise<ApiResponse<FrameExtractionTask>> {
  return fetchApi<FrameExtractionTask>(`/frames/task/${taskId}`);
}

/**
 * Get extracted frames for a video
 */
export async function getExtractedFrames(
  videoId: string
): Promise<ApiResponse<FramesListResponse>> {
  return fetchApi<FramesListResponse>(`/frames/${videoId}`);
}

/**
 * Select a frame
 */
export async function selectFrame(
  frameId: string
): Promise<ApiResponse<{ message: string }>> {
  return fetchApi<{ message: string }>(`/frames/select`, {
    method: 'POST',
    body: JSON.stringify({ frame_id: frameId }),
  });
}

/**
 * Unselect a frame
 */
export async function unselectFrame(
  frameId: string
): Promise<ApiResponse<{ message: string }>> {
  return fetchApi<{ message: string }>(`/frames/unselect`, {
    method: 'POST',
    body: JSON.stringify({ frame_id: frameId }),
  });
}

/**
 * Debug function to check video ID handling
 */
export async function debugVideoId(videoId: string): Promise<ApiResponse<any>> {
  console.log("Debugging video ID:", videoId);
  return fetchApi<any>(`/frames/debug/${videoId}`);
}

// Debug function to check metadata for a video_id
export const debugVideoMetadata = async (videoId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/frames/debug/${videoId}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Debug API error:', errorText);
      return { error: `API error: ${response.status}`, data: null };
    }
    
    const data = await response.json();
    return { error: null, data };
  } catch (error) {
    console.error('Error checking video metadata:', error);
    return { error: String(error), data: null };
  }
};

export default {
  checkApiHealth,
  uploadVideo,
  deleteVideo,
  startFrameExtraction,
  getFrameExtractionStatus,
  getExtractedFrames,
  selectFrame,
  unselectFrame,
  debugVideoId,
  debugVideoMetadata,
}; 