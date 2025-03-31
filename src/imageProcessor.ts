import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

export interface ProcessedImage {
  originalUrl: string;
  resizedUrl: string;
  originalSize: number;
  resizedSize: number;
  dimensions: {
    width: number;
    height: number;
  };
}

export async function processImage(
  imagePath: string,
  outputDir: string,
  index: number
): Promise<ProcessedImage> {
  try {
    // Create resized directory if it doesn't exist
    const resizedDir = path.join(outputDir, 'resized');
    if (!fs.existsSync(resizedDir)) {
      fs.mkdirSync(resizedDir, { recursive: true });
    }

    // Change extension to .png for the output file
    const resizedImagePath = path.join(resizedDir, `resized-${index}.png`);
    
    // Validate image before processing
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Invalid image dimensions');
    }

    // Calculate scaling to fit within 1920x1080 while maintaining aspect ratio
    const maxWidth = 1920;
    const maxHeight = 1080;
    const scaleRatio = Math.min(
      maxWidth / metadata.width,
      maxHeight / metadata.height,
      1 // Don't upscale if image is smaller
    );
    
    const newWidth = Math.floor(metadata.width * scaleRatio);
    const newHeight = Math.floor(metadata.height * scaleRatio);

    // Get original image size
    const originalStats = fs.statSync(imagePath);
    
    // Process image with more robust error handling
    await image
      .rotate() // Auto-rotate based on EXIF data
      .resize(newWidth, newHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png({ // Change to PNG format
        compressionLevel: 9, // Maximum compression
        quality: 80
      })
      .toBuffer() // Process to buffer first to validate
      .then(buffer => {
        return sharp(buffer).toFile(resizedImagePath);
      });
    
    // Get resized image size and metadata
    const resizedStats = fs.statSync(resizedImagePath);
    const resizedMetadata = await sharp(resizedImagePath).metadata();
    
    return {
      originalUrl: `/uploads/${path.basename(imagePath)}`,
      resizedUrl: `/uploads/resized/${path.basename(resizedImagePath)}`,
      originalSize: originalStats.size,
      resizedSize: resizedStats.size,
      dimensions: {
        width: resizedMetadata.width || 0,
        height: resizedMetadata.height || 0
      }
    };
  } catch (error) {
    // Clean up any partial files
    try {
      const resizedPath = path.join(outputDir, 'resized', `resized-${index}.png`);
      if (fs.existsSync(resizedPath)) {
        fs.unlinkSync(resizedPath);
      }
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError);
    }

    // Throw a more descriptive error
    throw new Error(`Failed to process image ${path.basename(imagePath)}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 