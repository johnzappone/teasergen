import express from 'express';
import { createServer } from 'vite';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { generateVideo } from './videoGenerator.js';
import { fileURLToPath } from 'url';
import { processImage, ProcessedImage } from './imageProcessor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createServer2() {
  const app = express();
  const port = 3000;

  // Add JSON body parser middleware
  app.use(express.json());

  // Serve static files first
  app.use('/output', express.static('output'));
  app.use('/uploads', express.static('uploads'));

  // Configure multer and API routes before Vite middleware
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  });

  const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/jpeg')) {
        cb(null, true);
      } else {
        cb(new Error('Only JPG files are allowed'));
      }
    },
  });

  // API routes
  app.post('/process-images', upload.array('images', 10), async (req, res) => {
    const uploadedFiles: string[] = [];
    const resizedFiles: string[] = [];

    try {
      if (!req.files || !Array.isArray(req.files)) {
        throw new Error('No files uploaded');
      }

      const files = req.files.map(file => file.path);
      uploadedFiles.push(...files);
      
      const generateVideoOption = req.body.generateVideo === 'true';

      // Process images one at a time to better handle errors
      const processedImages: ProcessedImage[] = [];
      for (let i = 0; i < files.length; i++) {
        try {
          const processed = await processImage(files[i], 'uploads', i);
          processedImages.push(processed);
          resizedFiles.push(processed.resizedUrl);
        } catch (error) {
          console.error(`Error processing image ${i}:`, error);
          throw new Error(`Failed to process image ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      let videoPath: string | undefined;

      // Generate video if requested
      if (generateVideoOption && processedImages.length > 0) {
        try {
          const outputPath = `output/teaser-${Date.now()}.mp4`;
          await generateVideo(
            processedImages.map(img => path.join('uploads', path.basename(img.resizedUrl))),
            outputPath,
            3,
            2,
            path.join(process.cwd(), 'music')
          );
          videoPath = outputPath;
        } catch (error) {
          console.error('Video generation failed:', error);
          // Continue with image processing results even if video fails
        }
      }

      res.json({
        success: true,
        images: processedImages,
        videoPath
      });
    } catch (error) {
      // Cleanup on error
      try {
        // Clean up uploaded original files
        uploadedFiles.forEach(file => {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        });

        // Clean up any resized files
        resizedFiles.forEach(resizedUrl => {
          const resizedPath = path.join(process.cwd(), resizedUrl);
          if (fs.existsSync(resizedPath)) {
            fs.unlinkSync(resizedPath);
          }
        });
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }
      
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  });

  // Separate endpoint for video generation
  app.post('/generate-video', async (req, res) => {
    try {
      const { images } = req.body;
      
      if (!images || !Array.isArray(images) || images.length === 0) {
        throw new Error('No images provided');
      }

      // Convert URLs to file paths
      const imagePaths = images.map(url => 
        path.join(process.cwd(), url.replace(/^\/uploads/, 'uploads'))
      );

      const outputPath = `output/teaser-${Date.now()}.mp4`;
      
      await generateVideo(
        imagePaths,
        outputPath,
        3,
        2,
        path.join(process.cwd(), 'music')
      );

      res.json({
        success: true,
        videoPath: outputPath
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  });

  // Create and use Vite middleware last
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
    root: process.cwd(),
  });

  app.use(vite.middlewares);

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

createServer2().catch((e) => {
  console.error(e);
  process.exit(1);
}); 