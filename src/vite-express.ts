import express from 'express';
import { createServer } from 'vite';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { generateVideo } from './videoGenerator.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createServer2() {
  const app = express();
  const port = 3000;

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
  app.post('/generate-teaser', upload.array('images', 10), async (req, res) => {
    try {
      if (!req.files || !Array.isArray(req.files)) {
        throw new Error('No files uploaded');
      }

      const files = req.files.map(file => file.path);
      const outputPath = `output/teaser-${Date.now()}.mp4`;
      
      await generateVideo(files, outputPath, 3, 2);
      
      // Cleanup uploaded files after video generation
      cleanupUploads(files);
      
      res.json({
        success: true,
        videoPath: outputPath
      });
    } catch (error) {
      // Also cleanup on error
      if (req.files && Array.isArray(req.files)) {
        cleanupUploads(req.files.map(file => file.path));
      }
      
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  });

  // Add this cleanup function
function cleanupUploads(files: string[]) {
  files.forEach(file => {
    fs.unlink(file, (err) => {
      if (err) {
        console.error(`Error deleting file ${file}:`, err);
      }
    });
  });
}

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