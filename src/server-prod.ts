import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';
import { generateVideo } from './videoGenerator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const port = process.env.PORT || 4173;

// Serve the built Vite app
app.use(express.static(path.resolve(__dirname, '../dist')));

// ... rest of your Express configuration (multer, API routes, etc.) ...

app.listen(port, () => {
  console.log(`Production server running at http://localhost:${port}`);
}); 