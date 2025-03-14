import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Downloads a file from a URL using the Blob API and createObjectURL
 * This provides a more reliable download experience than direct anchor links
 * 
 * @param url URL of the file to download
 * @param filename Desired filename for the downloaded file
 * @returns Promise that resolves when download is initiated or rejects on error
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  try {
    console.log(`Downloading file: ${filename} from ${url}`);
    
    // Fetch the file
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }
    
    // Convert to blob
    const blob = await response.blob();
    
    // Create object URL
    const objectUrl = URL.createObjectURL(blob);
    
    // Create temporary anchor element
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.style.display = 'none';
    
    // Add to document, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up by revoking the object URL after a short delay
    // This ensures the download has time to start
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      console.log(`Download initiated for ${filename}`);
    }, 100);
    
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}

/**
 * Downloads multiple files sequentially
 * 
 * @param files Array of {url, filename} objects to download
 * @returns Promise that resolves when all downloads are initiated
 */
export async function downloadMultipleFiles(
  files: Array<{ url: string; name: string }>
): Promise<void> {
  console.log(`Starting download of ${files.length} files`);
  
  try {
    // Process files sequentially to avoid overwhelming the browser
    for (const file of files) {
      await downloadFile(file.url, file.name);
      // Small delay between downloads
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`Initiated download of ${files.length} files`);
  } catch (error) {
    console.error('Error downloading multiple files:', error);
    throw error;
  }
}
