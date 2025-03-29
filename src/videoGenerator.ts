import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import path from 'path';
import ffmpegStatic from 'ffmpeg-static';

if (!ffmpegStatic) {
  throw new Error('ffmpeg-static path not found');
}
ffmpeg.setFfmpegPath(ffmpegStatic);

const fps = 30;  // Add fps constant for smooth motion

const TRANSITION_EFFECTS = [
  'fade',
  'fadeblack',
  'fadewhite',
  'distance',
  'wipeleft',
  'wiperight',
  'wipeup',
  'wipedown',
  'slideleft',
  'slideright',
  'slideup',
  'slidedown',
  'circlecrop',
  'rectcrop',
  'circleclose',
  'circleopen',
  'horzclose',
  'horzopen',
  'vertclose',
  'vertopen',
  'diagbl',
  'diagbr',
  'diagtl',
  'diagtr'
];

// Adjust zoom effects to be more subtle
const ZOOM_EFFECTS = [
  { start: 1.0, end: 1.05 },   // Slight zoom in
  { start: 1.05, end: 1.0 },   // Slight zoom out
  { start: 0.95, end: 1.0 },   // Start zoomed out
  { start: 1.0, end: 0.95 }    // End zoomed out
];

// Reduce rotation range
const ROTATION_EFFECTS = [
  { start: 0, end: 1 },     // Slight clockwise
  { start: 0, end: -1 },    // Slight counter-clockwise
  { start: -1, end: 0 },    // Return from counter-clockwise
  { start: 1, end: 0 }      // Return from clockwise
];

function getRandomTransition(): string {
  const randomIndex = Math.floor(Math.random() * TRANSITION_EFFECTS.length);
  return TRANSITION_EFFECTS[randomIndex];
}

function getRandomEffect<T>(effects: T[]): T {
  return effects[Math.floor(Math.random() * effects.length)];
}

function getRandomMusic(musicDir: string): string | null {
  try {
    const files = fs.readdirSync(musicDir)
      .filter(file => file.toLowerCase().endsWith('.mp3'));
    
    if (files.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * files.length);
    
    return path.join(musicDir, files[randomIndex]);
  } catch (error) {
    console.error('Error reading music directory:', error);
    return null;
  }
}

async function preprocessImage(inputPath: string, maxHeight: number = 480): Promise<string> {
  const outputPath = path.join('temp', `processed-${path.basename(inputPath)}`);
  
  // Ensure temp directory exists
  if (!fs.existsSync('temp')) {
    fs.mkdirSync('temp', { recursive: true });
  }

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .outputOptions([
        '-vf scale=\'min(854,iw)\':\'min(480,ih)\':force_original_aspect_ratio=decrease',  // 480p
        '-c:v libx264',
        '-preset ultrafast',
        '-qp 0'
      ])
      .output(outputPath)
      .on('start', (cmd) => console.log('Processing image:', inputPath))
      .on('end', () => {
        console.log('Processed:', outputPath);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('Error processing image:', inputPath, err);
        reject(err);
      })
      .run();
  });
}

export async function generateVideo(
  imagePaths: string[],
  outputPath: string,
  duration: number = 3,
  transitionDuration: number = 2,
  musicDir: string = 'music'
): Promise<void> {
  try {
    console.log('Preprocessing images...');
    const processedImages = await Promise.all(
      imagePaths.map(img => preprocessImage(img))
    );

    return new Promise((resolve, reject) => {
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      let command = ffmpeg();

      // Calculate total video duration
      const totalDuration = (imagePaths.length * duration) + 
        ((imagePaths.length - 1) * transitionDuration);
      
      console.log('Video configuration:', {
        images: imagePaths.length,
        duration,
        transitionDuration,
        totalDuration
      });

      // Add music if available
      const musicPath = getRandomMusic(musicDir);
      let hasAudio = false;
      if (musicPath) {
        command = command
          .input(musicPath)
          .audioFilters([
            'volume=0.5',
            `atrim=duration=${totalDuration}`  // Trim to exact duration
          ]);
        hasAudio = true;
      }

      // Add images without loop option
      processedImages.forEach((imagePath) => {
        command = command
          .input(imagePath)
          .inputOptions(['-t', duration.toString()]);  // Just set duration
      });

      // Create simpler filter chain
      const filterComplex = [];
      
      // Scale and add minimal effects
      processedImages.forEach((_, i) => {
        const idx = hasAudio ? i + 1 : i;
        const zoom = getRandomEffect(ZOOM_EFFECTS);

        filterComplex.push(
          `[${idx}:v]scale=854:480:force_original_aspect_ratio=decrease,` +  // 480p (16:9)
          `pad=854:480:-1:-1,setsar=1,` +
          // Simpler zoom effect
          `scale=iw*'${zoom.start}+((${zoom.end}-${zoom.start})*t/${duration})':ih*'${zoom.start}+((${zoom.end}-${zoom.start})*t/${duration})'` +
          `,fps=24[v${i}]`
        );
      });

      // Create transition chain with corrected timing
      let lastOutput = 'v0';
      for (let i = 1; i < processedImages.length; i++) {
        const transitionStart = i * duration;
        const transitionEffect = getRandomTransition();
        
        filterComplex.push(
          `[${lastOutput}][v${i}]xfade=transition=${transitionEffect}:duration=${transitionDuration}:offset=${transitionStart}[transition${i}]`
        );
        lastOutput = `transition${i}`;
      }

      command
        .on('end', () => {
          // Cleanup processed images
          processedImages.forEach(file => {
            fs.unlink(file, (err) => {
              if (err) console.error(`Error deleting temp file ${file}:`, err);
            });
          });
          console.log('Video generation completed');
          resolve();
        })
        .on('error', (err) => {
          // Cleanup on error too
          processedImages.forEach(file => {
            fs.unlink(file, (err) => {
              if (err) console.error(`Error deleting temp file ${file}:`, err);
            });
          });
          console.error('Error:', err);
          reject(err);
        })
        .complexFilter(filterComplex.join(';'), [lastOutput])
        .outputOptions([
          '-movflags +faststart',
          '-pix_fmt yuv420p',
          ...(hasAudio ? ['-map 0:a'] : []),
          `-t ${totalDuration}`,
          '-preset ultrafast',  // Use faster encoding
          '-tune fastdecode'    // Optimize for decoding speed
        ])
        .output(outputPath)
        .run();
    });
  } catch (error) {
    console.error('Error in preprocessing:', error);
    throw error;
  }
} 