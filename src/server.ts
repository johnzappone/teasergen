import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { generateVideo } from './videoGenerator';

const app = express();
const port = 3000;

// Add this to serve static files
app.use(express.static('public'));

// Add the root route handler
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Configure multer for handling file uploads
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

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 