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

function getRandomMusic(musicDir: string): string | null {
  try {
    const files = fs.readdirSync(musicDir)
      .filter(file => file.toLowerCase().endsWith('.mp3'));
    
    if (files.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * files.length);
    console.log("importing music", path.join(musicDir, files[randomIndex]));
    return path.join(musicDir, files[randomIndex]);
  } catch (error) {
    console.error('Error reading music directory:', error);
    return null;
  }
}

export async function generateVideo(
  imagePaths: string[],
  outputPath: string,
  duration: number = 3,
  transitionDuration: number = 2,
  musicDir: string = 'music'
): Promise<void> {
  return new Promise((resolve, reject) => {
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    let command = ffmpeg();
    let inputIndex = 0;

    // Calculate total video duration precisely
    const totalDuration = (imagePaths.length * duration) + 
      ((imagePaths.length - 1) * transitionDuration);
    
    console.log('Video configuration:');
    console.log(`- Number of images: ${imagePaths.length}`);
    console.log(`- Duration per image: ${duration} seconds`);
    console.log(`- Transition duration: ${transitionDuration} seconds`);
    console.log(`- Total video duration: ${totalDuration} seconds`);

    // Add music if available
    const musicPath = getRandomMusic(musicDir);
    let hasAudio = false;
    if (musicPath) {
      console.log('Audio configuration:');
      console.log(`- Audio file: ${musicPath}`);
      console.log(`- Target audio duration: ${totalDuration} seconds`);
      
      command = command
        .input(musicPath)
        .inputOptions([
          '-stream_loop -1'  // Loop audio if needed
        ])
        .audioFilters([
          'volume=0.5'  // Just adjust volume, no fade
        ])
        .outputOptions([
          '-map 0:a',
          `-t ${totalDuration}`,  // Set exact duration first
          `-af apad`  // Then pad if needed
        ]);
      hasAudio = true;
      inputIndex++;
    }

    // Add images
    imagePaths.forEach((imagePath) => {
      command = command
        .input(imagePath)
        .inputOptions(['-loop 1', '-t', (duration + transitionDuration * 2).toString()]);
    });

    // Create the complex filter string
    const filterComplex = [];
    
    // Scale all inputs to same size and add text
    imagePaths.forEach((_, i) => {
      const idx = hasAudio ? i + 1 : i;  // Adjust index if we have audio
      filterComplex.push(
        `[${idx}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:-1:-1,setsar=1,` +
        `drawtext=text='Image ${i + 1}':fontsize=72:fontcolor=white:` +
        `x=(w-text_w)/2:y=h-th-20:box=1:boxcolor=black@0.5:boxborderw=5[v${i}]`
      );
    });

    // Create the transition chain
    let lastOutput = 'v0';
    for (let i = 1; i < imagePaths.length; i++) {
      const transitionStart = i * (duration + transitionDuration);
      const transitionEffect = getRandomTransition();
      
      console.log(`Transition ${i}: ${transitionEffect} at ${transitionStart}s`);
      
      filterComplex.push(
        `[${lastOutput}][v${i}]xfade=transition=${transitionEffect}:duration=${transitionDuration}:offset=${transitionStart}[transition${i}]`
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
        '-pix_fmt yuv420p',
        ...(hasAudio ? [
          '-map 0:a',
          `-t ${totalDuration}`  // Force duration again in final output
        ] : [])
      ])
      .output(outputPath)
      .run();
  });
} 