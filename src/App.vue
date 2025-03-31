<template>
  <div class="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
    <div class="relative py-3 sm:max-w-xl sm:mx-auto">
      <div class="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
        <div class="max-w-md mx-auto">
          <div class="divide-y divide-gray-200">
            <div class="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
              <h1 class="text-3xl font-bold text-center mb-8">Image Processor</h1>
              
              <!-- Step 1: Image Processing -->
              <div v-if="!processingComplete">
                <form @submit.prevent="processImages" class="space-y-6">
                  <div v-for="(file, index) in files" :key="index" class="space-y-2">
                    <div class="flex items-center space-x-4">
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png"
                        @change="handleFileChange($event, index)"
                        class="block w-full text-sm text-gray-500
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-full file:border-0
                          file:text-sm file:font-semibold
                          file:bg-blue-50 file:text-blue-700
                          hover:file:bg-blue-100"
                        :required="index === 0"
                      />
                      <span v-if="fileNames[index]" class="text-sm text-gray-500">
                        {{ fileNames[index] }}
                      </span>
                    </div>
                  </div>

                  <div class="flex items-center space-x-4 justify-center">
                    <label class="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        v-model="generateVideo"
                        class="form-checkbox h-4 w-4 text-blue-600"
                      />
                      <span>Generate Video</span>
                    </label>
                  </div>

                  <div class="flex justify-center">
                    <button
                      type="submit"
                      class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full
                             transition duration-300 ease-in-out transform hover:scale-105"
                      :disabled="processing"
                    >
                      {{ processing ? 'Processing...' : 'Process Images' }}
                    </button>
                  </div>
                </form>
              </div>

              <!-- Step 2: Preview and Continue -->
              <div v-if="processingComplete && processedImages.length > 0" class="mt-8 space-y-8">
                <h2 class="text-2xl font-bold text-center">Processed Images</h2>
                <div v-for="(image, index) in processedImages" :key="index" class="space-y-4">
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <h3 class="text-center mb-2">Original</h3>
                      <img :src="image.original" class="w-full rounded-lg shadow-md" />
                      <p class="text-sm text-center mt-1">{{ image.originalSize }}</p>
                    </div>
                    <div>
                      <h3 class="text-center mb-2">Resized</h3>
                      <img :src="image.resized" class="w-full rounded-lg shadow-md" />
                      <p class="text-sm text-center mt-1">
                        {{ image.resizedSize }} <br>
                        {{ image.dimensions.width }}x{{ image.dimensions.height }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Video Generation Section -->
                <div v-if="!videoGenerated" class="flex flex-col items-center space-y-4 mt-8">
                  <label class="flex items-center space-x-2 mb-4">
                    <input
                      type="checkbox"
                      v-model="kenBurnsEnabled"
                      class="form-checkbox h-4 w-4 text-blue-600"
                    />
                    <span>Enable Ken Burns Effect</span>
                  </label>
                  <button
                    @click="startVideoGeneration"
                    class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-full
                           transition duration-300 ease-in-out transform hover:scale-105"
                    :disabled="generating"
                  >
                    {{ generating ? 'Generating Video...' : 'Generate Video' }}
                  </button>
                </div>

                <!-- Generated Video Section -->
                <div v-if="videoGenerated" class="flex flex-col items-center space-y-4 mt-8">
                  <h2 class="text-2xl font-bold text-center">Generated Video</h2>
                  <video 
                    :src="videoUrl" 
                    controls 
                    class="w-full max-w-3xl rounded-lg shadow-lg"
                    autoplay
                    loop
                    muted
                    playsinline
                  ></video>
                  <div class="flex space-x-4">
                    <button
                      @click="downloadVideo"
                      class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-full
                             transition duration-300 ease-in-out transform hover:scale-105"
                    >
                      Download Video
                    </button>
                    <button
                      @click="restartProcess"
                      class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-full
                             transition duration-300 ease-in-out transform hover:scale-105"
                    >
                      Create New Video
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const files = ref<(File | null)[]>([null]);
const fileNames = ref<string[]>([]);
const processing = ref(false);
const generating = ref(false);
const processingComplete = ref(false);
const generateVideo = ref(false);
const kenBurnsEnabled = ref(true);
const videoGenerated = ref(false);
const videoUrl = ref<string>('');
const processedImages = ref<Array<{
  original: string;
  resized: string;
  originalSize: string;
  resizedSize: string;
  dimensions: {
    width: number;
    height: number;
  };
}>>([]);

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function handleFileChange(event: Event, index: number) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    files.value[index] = input.files[0];
    fileNames.value[index] = input.files[0].name;
    
    // Add new input if this is the last one and has a file
    if (index === files.value.length - 1) {
      files.value.push(null);
      fileNames.value.push('');
    }
  }
}

async function processImages() {
  processing.value = true;
  processedImages.value = [];
  
  try {
    const formData = new FormData();
    files.value.forEach((file) => {
      if (file) {
        formData.append('images', file);
      }
    });
    
    const response = await fetch('/process-images', {
      method: 'POST',
      body: formData,
    });
    
    const result = await response.json();
    
    if (result.success) {
      processedImages.value = result.images.map((img: any) => ({
        original: img.originalUrl,
        resized: img.resizedUrl,
        originalSize: formatFileSize(img.originalSize),
        resizedSize: formatFileSize(img.resizedSize),
        dimensions: img.dimensions
      }));
      processingComplete.value = true;
    } else {
      throw new Error(result.error || 'Processing failed');
    }
  } catch (error) {
    console.error('Error:', error);
    alert(error instanceof Error ? error.message : 'Failed to process images. Please try again.');
  } finally {
    processing.value = false;
  }
}

async function startVideoGeneration() {
  generating.value = true;
  
  try {
    const response = await fetch('/generate-video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images: processedImages.value.map(img => img.resized),
        kenBurnsEnabled: kenBurnsEnabled.value
      }),
    });
    
    const result = await response.json();
    
    if (result.success && result.videoUrl) {
      videoUrl.value = result.videoUrl.startsWith('/') ? result.videoUrl : `/${result.videoUrl}`;
      videoGenerated.value = true;
    } else {
      throw new Error(result.error || 'Video generation failed');
    }
  } catch (error) {
    console.error('Error:', error);
    alert(error instanceof Error ? error.message : 'Failed to generate video. Please try again.');
  } finally {
    generating.value = false;
  }
}

function downloadVideo() {
  const link = document.createElement('a');
  link.href = videoUrl.value;
  link.download = 'generated-video.mp4';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function restartProcess() {
  // Reset all state
  files.value = [null];
  fileNames.value = [];
  processing.value = false;
  generating.value = false;
  processingComplete.value = false;
  generateVideo.value = false;
  kenBurnsEnabled.value = true;
  videoGenerated.value = false;
  videoUrl.value = '';
  processedImages.value = [];
}
</script> 