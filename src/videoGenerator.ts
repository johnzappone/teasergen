import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import path from 'path';
import ffmpegStatic from 'ffmpeg-static';

if (!ffmpegStatic) {
  throw new Error('ffmpeg-static path not found');
}
ffmpeg.setFfmpegPath(ffmpegStatic);

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

function getRandomTransition(): string {
  const randomIndex = Math.floor(Math.random() * TRANSITION_EFFECTS.length);
  return TRANSITION_EFFECTS[randomIndex];
}

export async function generateVideo(
  imagePaths: string[],
  outputPath: string,
  duration: number = 3,
  transitionDuration: number = 2
): Promise<void> {
  return new Promise((resolve, reject) => {
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    let command = ffmpeg();

    // Add each image with extended duration to account for transitions
    imagePaths.forEach((imagePath) => {
      command = command
        .input(imagePath)
        .inputOptions(['-loop 1', '-t', (duration + transitionDuration * 2).toString()]);
    });

    // Create the complex filter string
    const filterComplex = [];
    
    // Scale all inputs to same size
    imagePaths.forEach((_, i) => {
      filterComplex.push(`[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:-1:-1,setsar=1[scaled${i}]`);
    });

    // Create the transition chain
    let lastOutput = 'scaled0';
    for (let i = 1; i < imagePaths.length; i++) {
      const transitionStart = i * (duration + transitionDuration);
      const transitionEffect = getRandomTransition();
      
      console.log(`Transition ${i}: ${transitionEffect} at ${transitionStart}s`);
      
      filterComplex.push(
        `[${lastOutput}][scaled${i}]xfade=transition=${transitionEffect}:duration=${transitionDuration}:offset=${transitionStart}[transition${i}]`
      );
      lastOutput = `transition${i}`;
    }

    command
      .on('end', () => {
        console.log('Video generation completed');
        resolve();
      })
      .on('error', (err) => {
        console.error('Error:', err);
        reject(err);
      })
      .complexFilter(filterComplex.join(';'), [lastOutput])
      .outputOptions([
        '-movflags +faststart',
        '-pix_fmt yuv420p'
      ])
      .output(outputPath)
      .run();
  });
} 