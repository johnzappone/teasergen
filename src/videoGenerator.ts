import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import path from 'path';
import ffmpegStatic from 'ffmpeg-static';

if (!ffmpegStatic) {
  throw new Error('ffmpeg-static path not found');
}
ffmpeg.setFfmpegPath(ffmpegStatic);

export async function generateVideo(
  imagePaths: string[],
  outputPath: string,
  duration: number = 3,
  transitionDuration: number = 1
): Promise<void> {
  return new Promise((resolve, reject) => {
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    let command = ffmpeg();

    // Add each image with duration + transition overlap
    imagePaths.forEach((imagePath) => {
      command = command
        .input(imagePath)
        .inputOptions([
          '-loop 1',
          `-t ${duration + transitionDuration}`
        ]);
    });

    // Create the complex filter string with crossfade transitions
    const filterComplex = [];
    
    // First scale all inputs to same size
    imagePaths.forEach((_, i) => {
      filterComplex.push(`[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:-1:-1,setsar=1[v${i}]`);
    });

    // Add crossfade transitions
    let lastOutput = 'v0';
    for (let i = 1; i < imagePaths.length; i++) {
      const fadeStart = duration - transitionDuration;
      filterComplex.push(
        `[${lastOutput}][v${i}]xfade=transition=fade:duration=${transitionDuration}:offset=${fadeStart}[v${i}out]`
      );
      lastOutput = `v${i}out`;
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
        '-pix_fmt yuv420p',
        '-movflags +faststart'
      ])
      .output(outputPath)
      .run();
  });
} 