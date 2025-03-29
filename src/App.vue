<template>
  <div class="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
    <div class="relative py-3 sm:max-w-xl sm:mx-auto">
      <div class="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
        <div class="max-w-md mx-auto">
          <div class="divide-y divide-gray-200">
            <div class="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
              <h1 class="text-3xl font-bold text-center mb-8">Video Teaser Generator</h1>
              
              <form @submit.prevent="uploadImages" class="space-y-6">
                <div v-for="(file, index) in files" :key="index" class="space-y-2">
                  <div class="flex items-center space-x-4">
                    <input
                      type="file"
                      accept=".jpg,.jpeg"
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

                <div class="flex justify-center">
                  <button
                    type="submit"
                    class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full
                           transition duration-300 ease-in-out transform hover:scale-105"
                    :disabled="processing"
                  >
                    {{ processing ? 'Generating...' : 'Generate Teaser' }}
                  </button>
                </div>
              </form>

              <div v-if="result" :class="['mt-6 p-4 rounded-lg', resultClass]">
                {{ result }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const files = ref(Array(5).fill(null))
const fileNames = ref<string[]>([])
const processing = ref(false)
const result = ref('')
const resultStatus = ref<'success' | 'error' | null>(null)

const resultClass = computed(() => ({
  'bg-green-100 text-green-800': resultStatus.value === 'success',
  'bg-red-100 text-red-800': resultStatus.value === 'error'
}))

function handleFileChange(event: Event, index: number) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    files.value[index] = input.files[0]
    fileNames.value[index] = input.files[0].name
  }
}

async function uploadImages(event: Event) {
  processing.value = true
  result.value = ''
  resultStatus.value = null

  const formData = new FormData()
  files.value.forEach(file => {
    if (file) {
      formData.append('images', file)
    }
  })

  try {
    const response = await fetch('/generate-teaser', {
      method: 'POST',
      body: formData
    })
    
    const data = await response.json()
    
    if (data.success) {
      result.value = `Video generated successfully! Path: ${data.videoPath}`
      resultStatus.value = 'success'
    } else {
      result.value = `Error: ${data.error}`
      resultStatus.value = 'error'
    }
  } catch (error) {
    result.value = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    resultStatus.value = 'error'
  } finally {
    processing.value = false
  }
}
</script> 