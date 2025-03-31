import express from 'express';
import { createServer } from 'vite';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { generateVideo } from './videoGenerator.js';
import { fileURLToPath } from 'url';
import { processImage, ProcessedImage } from './imageProcessor.js';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createServer2() {
  const app = express();
  const port = 3000;

  // Add JSON body parser middleware
  app.use(express.json());

  // Serve static files first
  app.use('/output', express.static('output'));
  app.use('/uploads', express.static('uploads'));

  // Configure multer for file uploads
  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });

  const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
      // Accept only jpg, jpeg, and png files
      if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
        cb(null, true);
      } else {
        cb(new Error('Only .jpg, .jpeg, and .png files are allowed'));
      }
    }
  });

  // API routes
  app.post('/process-images', upload.array('images'), async (req, res) => {
    try {
      if (!req.files || !Array.isArray(req.files)) {
        throw new Error('No files uploaded');
      }

      const processedImages = await Promise.all(
        (req.files as Express.Multer.File[]).map(async (file) => {
          const originalPath = file.path;
          const resizedPath = path.join(uploadDir, `resized_${file.filename}`);
          
          // Get original image dimensions
          const originalMetadata = await sharp(originalPath).metadata();
          const originalWidth = originalMetadata.width || 0;
          const originalHeight = originalMetadata.height || 0;
          
          // Calculate new dimensions maintaining aspect ratio
          const maxWidth = 1920;
          const maxHeight = 1080;
          const aspectRatio = originalWidth / originalHeight;
          
          let newWidth = originalWidth;
          let newHeight = originalHeight;
          
          if (originalWidth > maxWidth || originalHeight > maxHeight) {
            if (aspectRatio > 1) {
              // Landscape
              newWidth = maxWidth;
              newHeight = Math.round(maxWidth / aspectRatio);
              if (newHeight > maxHeight) {
                newHeight = maxHeight;
                newWidth = Math.round(maxHeight * aspectRatio);
              }
            } else {
              // Portrait
              newHeight = maxHeight;
              newWidth = Math.round(maxHeight * aspectRatio);
              if (newWidth > maxWidth) {
                newWidth = maxWidth;
                newHeight = Math.round(maxWidth / aspectRatio);
              }
            }
          }

          // Process image based on file type
          const isPNG = file.mimetype === 'image/png';
          const sharpInstance = sharp(originalPath)
            .resize(newWidth, newHeight, {
              fit: 'inside',
              withoutEnlargement: true
            });

          if (isPNG) {
            // For PNG, preserve transparency and optimize
            await sharpInstance
              .png({ quality: 90, compressionLevel: 9 })
              .toFile(resizedPath);
          } else {
            // For JPG, convert to RGB and optimize
            await sharpInstance
              .jpeg({ quality: 90, mozjpeg: true })
              .toFile(resizedPath);
          }

          // Get processed image size
          const stats = await fs.promises.stat(resizedPath);
          
          return {
            originalUrl: `/uploads/${file.filename}`,
            resizedUrl: `/uploads/resized_${file.filename}`,
            originalSize: stats.size,
            resizedSize: stats.size,
            dimensions: {
              width: newWidth,
              height: newHeight
            }
          };
        })
      );

      res.json({ success: true, images: processedImages });
    } catch (error) {
      console.error('Error processing images:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process images' 
      });
    }
  });

  // Separate endpoint for video generation
  app.post('/generate-video', async (req, res) => {
    try {
      const { images, kenBurnsEnabled } = req.body;
      
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
        path.join(process.cwd(), 'music'),
        { kenBurnsEnabled }
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