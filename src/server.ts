import express from 'express';
import multer from 'multer';
import path from 'path';
import { generateVideo } from './videoGenerator';

const app = express();
const port = 3000;

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

app.post('/generate-teaser', upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || !Array.isArray(req.files)) {
      throw new Error('No files uploaded');
    }

    const files = req.files.map(file => file.path);
    const outputPath = `output/teaser-${Date.now()}.mp4`;
    
    await generateVideo(files, outputPath);
    
    res.json({
      success: true,
      videoPath: outputPath
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 