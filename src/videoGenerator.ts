import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import path from 'path';

export async function generateVideo(
  imagePaths: string[],
  outputPath: string,
  duration: number = 3
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Create output directory if it doesn't exist
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    let command = ffmpeg();

    // Add each image with duration
    imagePaths.forEach(imagePath => {
      command = command.input(imagePath).inputOptions([`-loop 1`, `-t ${duration}`]);
    });

    command
      .on('end', () => {
        console.log('Video generation completed');
        resolve();
      })
      .on('error', (err) => {
        console.error('Error:', err);
        reject(err);
      })
      // Configure the output video
      .complexFilter([
        {
          filter: 'concat',
          options: {
            n: imagePaths.length,
            v: 1
          }
        },
        {
          filter: 'fade',
          options: {
            t: 'in:0:30'
          }
        }
      ])
      .outputOptions(['-pix_fmt yuv420p']) // Ensure compatibility
      .output(outputPath)
      .run();
  });
} 