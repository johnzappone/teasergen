import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import path from 'path';
import ffmpegStatic from 'ffmpeg-static';
import sharp from 'sharp';

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

// Add new constants for Ken Burns effect
const KEN_BURNS_EFFECTS = [
  // Center zoom out to in
  'zoompan=z=min(zoom+0.002,1.2):x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':d=duration:s=1920x1080',
  // Center zoom in to out
  'zoompan=z=max(zoom-0.002,0.9):x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':d=duration:s=1920x1080',
  // Top-left to center
  'zoompan=z=min(zoom+0.002,1.3):x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':d=duration:s=1920x1080',
  // Bottom-right to center
  'zoompan=z=min(zoom+0.002,1.2):x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':d=duration:s=1920x1080',
  // Center to top-right
  'zoompan=z=min(zoom+0.002,1.4):x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':d=duration:s=1920x1080',
  // Center to bottom-left
  'zoompan=z=min(zoom+0.002,1.3):x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':d=duration:s=1920x1080',
  // Slow zoom out
  'zoompan=z=max(zoom-0.001,0.8):x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':d=duration:s=1920x1080',
  // Quick zoom in
  'zoompan=z=min(zoom+0.003,1.2):x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':d=duration:s=1920x1080'
];

// Add new constants for color effects
const COLOR_EFFECTS = [
  // Warm tone
  'eq=gamma_r=1.1:gamma_g=1.0:gamma_b=0.9',
  // Cool tone
  'eq=gamma_r=0.9:gamma_g=1.0:gamma_b=1.1',
  // Vintage look
  'eq=gamma_r=1.1:gamma_g=1.1:gamma_b=1.1:saturation=0.8',
  // High contrast
  'eq=contrast=1.2:brightness=0.1:saturation=1.1',
  // Sepia
  'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131',
  // Vibrant
  'eq=saturation=1.5:contrast=1.1:brightness=0.1',
  // Faded
  'eq=saturation=0.7:contrast=0.9:brightness=0.05',
  // No effect (normal)
  'null'
];

function getRandomTransition(): string {
  const randomIndex = Math.floor(Math.random() * TRANSITION_EFFECTS.length);
  return TRANSITION_EFFECTS[randomIndex];
}

function getRandomKenBurns(duration: number): string {
  const randomIndex = Math.floor(Math.random() * KEN_BURNS_EFFECTS.length);
  return KEN_BURNS_EFFECTS[randomIndex].replace('duration', duration.toString());
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

function getRandomColorEffect(): string {
  const randomIndex = Math.floor(Math.random() * COLOR_EFFECTS.length);
  return COLOR_EFFECTS[randomIndex];
}

export async function generateVideo(
  imagePaths: string[],
  outputPath: string,
  duration: number = 3,
  transitionDuration: number = 2,
  musicDir: string = 'music',
  options: {
    title?: string,
    titleFont?: string,
    imageTextEnabled?: boolean,
    kenBurnsEnabled?: boolean
  } = {}
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    // Create logs directory if it doesn't exist
    const logsDir = path.join('logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Create a log file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(logsDir, `ffmpeg-${timestamp}.log`);
    const logStream = fs.createWriteStream(logFile);

    // Function to log to both console and file
    const log = (message: string) => {
      console.log(message);
      logStream.write(message + '\n');
    };

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create a subdirectory for resized images
    const resizedDir = path.join('uploads', 'resized');
    if (!fs.existsSync(resizedDir)) {
      fs.mkdirSync(resizedDir, { recursive: true });
    }

    // Resize images to 50% and save them to the resized directory
    const resizedImagePaths = await Promise.all(imagePaths.map(async (imagePath, index) => {
      const resizedImagePath = path.join(resizedDir, `resized-${index}.jpg`);
      await sharp(imagePath)
        .resize({ width: Math.floor(await sharp(imagePath).metadata().then(meta => meta.width! / 2)) })
        .toFile(resizedImagePath);
      return resizedImagePath;
    }));

    let command = ffmpeg();
    let inputIndex = 0;

    // Calculate total video duration precisely
    const totalDuration = (resizedImagePaths.length * duration) + 
      ((resizedImagePaths.length - 1) * transitionDuration);
    
    console.log('Video configuration:');
    console.log(`- Number of images: ${resizedImagePaths.length}`);
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
        .inputOptions(['-stream_loop -1'])
        .audioFilters([
          `volume=0.5,` +
          `afade=t=in:st=0:d=2,` +  // Fade in first 2 seconds
          `afade=t=out:st=${totalDuration-2}:d=2`  // Fade out last 2 seconds
        ])
        .outputOptions([
          '-map 0:a',
          `-t ${totalDuration}`,
          `-af apad`
        ]);
      hasAudio = true;
      inputIndex++;
    }

    // Add resized images with Ken Burns effect
    resizedImagePaths.forEach((imagePath) => {
      command = command
        .input(imagePath)
        .inputOptions(['-loop 1', '-t', (duration + transitionDuration * 2).toString()]);
    });

    // Create the complex filter string
    const filterComplex = [];
    
    // Scale and apply effects to all inputs
    resizedImagePaths.forEach((_, i) => {
      const idx = hasAudio ? i + 1 : i;  // Adjust index if we have audio
      let filter = `[${idx}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1`;
      
      // Add random color effect
      filter += `,${getRandomColorEffect()}`;
      
      // Add Ken Burns effect if enabled
      if (options.kenBurnsEnabled !== false) {
        // Generate random speeds for this image
        const zoomSpeed = 0.0003 + Math.random() * 0.0004; // Random speed between 0.0003 and 0.0007
        const maxZoom = 1.05 + Math.random() * 0.05; // Random max zoom between 1.05 and 1.1
        const rotationSpeed = 0.05 + Math.random() * 0.1; // Random speed between 0.05 and 0.15
        const maxRotation = 0.02 + Math.random() * 0.03; // Random max rotation between 0.02 and 0.05
        const rotationDirection = i % 2 === 0 ? 1 : -1; // Alternate between clockwise (1) and counterclockwise (-1)

        // Apply zoompan with random speed
        filter += `,zoompan=z='min(zoom+${zoomSpeed},${maxZoom})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${duration + transitionDuration * 2}:s=1920x1080:fps=30`;
        // Add smooth rotation with random speed and alternating direction
        filter += `,rotate='min((t-${i * (duration + transitionDuration)})*${rotationSpeed}*${rotationDirection},${maxRotation})':c=black@0:ow=1920:oh=1080`;
      }
      
      // Add blur effect that fades in and out
      filter += `,fade=t=in:st=0:d=0.5,fade=t=out:st=${duration-1}:d=0.5`;
      
      // Add text overlay if enabled
      if (options.imageTextEnabled !== false) {
        const text = options.title || `Image ${i + 1}`;
        const fontPath = options.titleFont || '/System/Library/Fonts/Arial.ttc';
        filter += `,drawtext=text='${text}':fontfile='${fontPath}':fontsize=72:fontcolor=white:shadowcolor=black@0.5:shadowx=2:shadowy=2:x=(w-text_w)/2:y=h-th-50:alpha='if(lt(t,1),0,if(lt(t,2),t-1,if(lt(t,${duration-1}),1,if(lt(t,${duration}),${duration}-t,0))))'`;
      }
      
      filter += `[v${i}]`;
      filterComplex.push(filter);
    });

    // Create the transition chain
    let lastOutput = 'v0';
    for (let i = 1; i < resizedImagePaths.length; i++) {
      const transitionStart = i * (duration + transitionDuration);
      const transitionEffect = getRandomTransition();
      
      console.log(`Transition ${i}: ${transitionEffect} at ${transitionStart}s`);
      
      filterComplex.push(
        `[${lastOutput}][v${i}]xfade=transition=${transitionEffect}:duration=${transitionDuration}:offset=${transitionStart}[transition${i}]`
      );
      lastOutput = `transition${i}`;
    }

    // Add the final output label
    filterComplex.push(`[${lastOutput}]setpts=PTS-STARTPTS[outv]`);

    command
      .on('end', () => {
        log('Video generation completed');
        logStream.end();
        resolve();
      })
      .on('error', (err) => {
        log(`Error: ${err.message}`);
        log(`Stack: ${err.stack}`);
        logStream.end();
        reject(err);
      })
      .on('start', (commandLine) => {
        log('Spawned Ffmpeg with command: ' + commandLine);
      })
      .on('stderr', (stderrLine) => {
        log(`FFmpeg: ${stderrLine}`);
      })
      .complexFilter(filterComplex, ['outv'])
      .outputOptions([
        '-movflags +faststart',
        '-pix_fmt yuv420p',
        '-loglevel debug',
        '-stats',
        ...(hasAudio ? [
          '-map 0:a',
          `-t ${totalDuration}`  // Force duration again in final output
        ] : [])
      ])
      .output(outputPath)
      .run();
  });
} 