<script lang="ts">
    import { todoService } from "$lib/client/todos";
    import { llmService } from '$lib/client/llm';
	import { getSectionsContext } from "$lib/client/context.svelte";
    import TodoSectionContainer from "$lib/components/TodoSectionContainer.svelte";
    import Popup from '$lib/components/Popup.svelte';
    import type { Form, FormOutput } from '$lib/components/Popup.svelte';
	import AddButton from "$lib/components/AddButton.svelte";

    // Get the sections context
    const sectionsContext = getSectionsContext()

    let userMessage = $state("")
    let llmMessage = $state("")
    let llmThinkingStatus: 'done' | 'thinking' | 'error' = $state("done")
    let isRecording = $state(false)
    let mediaRecorder: MediaRecorder | null = null
    let recordingError = $state("")

    let newSectionFormInput: Form = [
        {
            label: "Name",
            value: "",
            placeholder: "Enter section name"
        }
    ]
    let showNewSectionPopup = $state(false)
    async function handleCreateSection(output: FormOutput) {
        if (output) {
            if (typeof output[0].value == 'string') {
                todoService.createSection(sectionsContext, {name: output[0].value})
            }
        }

        showNewSectionPopup = false
    }

    async function toggleRecording() {
        if (isRecording) {
            // Stop recording
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop()
            }
            isRecording = false
        } else {
            // Start recording
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
                mediaRecorder = new MediaRecorder(stream)
                
                let audioChunks: Blob[] = []
                
                mediaRecorder.ondataavailable = (event) => {
                    audioChunks.push(event.data)
                }
                
                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
                    
                    try {
                        // Save the audio to the expected file location
                        await saveAudioFile(audioBlob)
                        
                        // Convert speech to text
                        await convertSpeechToText()
                        recordingError = ""
                    } catch (error) {
                        console.error('Error processing recording:', error)
                        recordingError = 'Failed to process recording. Please try again.'
                    }
                    
                    // Stop all tracks to free up the microphone
                    stream.getTracks().forEach(track => track.stop())
                }
                
                mediaRecorder.start()
                isRecording = true
                recordingError = ""
            } catch (error) {
                console.error('Error accessing microphone:', error)
                recordingError = 'Unable to access microphone. Please check your permissions.'
                isRecording = false
            }
        }
    }

    async function saveAudioFile(audioBlob: Blob) {
        // Convert blob to array buffer and then to base64
        const arrayBuffer = await audioBlob.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        const base64String = btoa(String.fromCharCode(...uint8Array))
        
        // Send to server to save as message.wav
        try {
            await llmService.saveAudio(base64String)
        } catch (error) {
            console.error('Error saving audio file:', error)
            throw error
        }
    }

    async function convertSpeechToText() {
        try {
            const response = await llmService.speechToText()
            if (response && response.text) {
                userMessage = response.text
                await submitChatMessage()
            } else {
                recordingError = 'No speech detected. Please try speaking more clearly.'
            }
        } catch (error) {
            console.error('Error converting speech to text:', error)
            recordingError = 'Failed to convert speech to text. Please try again.'
            throw error
        }
    }

    async function submitChatMessage() {
        llmThinkingStatus = 'thinking'
        try {
            let response = await llmService.sendMessage(sectionsContext, userMessage)
            llmThinkingStatus = 'done'
            userMessage = ''
            llmMessage = response.text || ""

            // Note: text to speech code is commented out due to low tokens per day allowance

            /*
            // text to speech
            let audioResponse = await llmService.textToSpeech(llmMessage)
            
            // Play the audio if we received audio data
            if (audioResponse?.audioData) {
                const audioBlob = new Blob([
                    Uint8Array.from(atob(audioResponse.audioData), c => c.charCodeAt(0))
                ], { type: audioResponse.mimeType || 'audio/wav' })
                
                const audioUrl = URL.createObjectURL(audioBlob)
                const audio = new Audio(audioUrl)
                
                audio.onended = () => {
                    URL.revokeObjectURL(audioUrl) // Clean up memory
                }
                
                audio.playbackRate = 1.25
                audio.play().catch(console.error)
            }
            */
        } catch (e) {
            llmThinkingStatus = 'error'
            console.log(e)
        }
    }
</script>

<h1 class="text-center w-full">Guppy</h1>

<div class='h-10'></div>

<div class='bg-slate-700 rounded-2xl overflow-clip'>
    <div class='p-1 flex w-full flex-col gap-2'>
        <div class='flex flex-col place-self-start'>
            <form onsubmit={async (e) => {
                e.preventDefault()

                await submitChatMessage()
            }}>
                <div class='flex flex-row gap-1'>
                    <input type="text" placeholder="Send a message to the LLM..." bind:value={userMessage} class='px-3 py-2 bg-slate-600 rounded-tl-2xl text-white border border-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent'>
                    <button 
                        type='button' 
                        class={`p-2 h-fit flex text-white transition-colors ${isRecording ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'}`}
                        onclick={toggleRecording}
                        disabled={llmThinkingStatus === 'thinking'}
                        title={isRecording ? 'Stop recording' : 'Start recording'}
                    >
                        <span class='material-symbols-outlined'>{isRecording ? 'stop' : 'mic'}</span>
                    </button>
                    <button type='submit' class='px-4 py-2 bg-green-600 text-white hover:bg-green-700 transition-colors' disabled={llmThinkingStatus === 'thinking'}>
                        <span>Send</span>
                    </button>
                </div>
            </form>
            {#if recordingError}
                <div class="mt-2 text-red-400 text-sm">
                    {recordingError}
                </div>
            {/if}
            {#if isRecording}
                <div class="mt-2 text-blue-400 text-sm flex items-center gap-1">
                    <svg class="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                        <circle cx="10" cy="10" r="3"/>
                    </svg>
                    Recording... Click the red button to stop
                </div>
            {/if}
        </div>
        <div class='flex place-self-end'>
            <!-- Thinking status indicator -->
            <div class="flex items-center place-self-start">
                {#if llmThinkingStatus === 'thinking'}
                    <span class="flex items-center gap-1 text-yellow-400" title="Thinking...">
                        <svg
                            class="size-5 animate-spin"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
                            ></circle>
                            <path
                                class="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                        </svg>
                    </span>
                {:else if llmThinkingStatus === 'done'}
                    <span class="flex items-center gap-1 text-green-400" title="Done">
                        <svg
                            class="size-5"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fill-rule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clip-rule="evenodd"
                            />
                        </svg>
                    </span>
                {:else}
                    <span class="flex items-center gap-1 text-red-400" title="Error">
                        <svg
                            class="size-5"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fill-rule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                clip-rule="evenodd"
                            />
                        </svg>
                    </span>
                {/if}
            </div>
            <span class='px-3 py-2 bg-slate-600 text-white border border-slate-500 rounded-br-2xl'>{llmMessage || '​'}</span>
        </div>
    </div>
</div>

<div class='h-10'></div>

<div class='flex flex-row place-items-center gap-4'>
    <h2>Sections:</h2>
    <AddButton onmousedown={() => {showNewSectionPopup = true}}></AddButton>
</div>

<div class='flex flex-row flex-wrap gap-4'>
    {#each sectionsContext.sections as section}
        <div class="flex min-w-100 flex-1">
            <TodoSectionContainer section={section}></TodoSectionContainer>
        </div>
    {/each}
</div>

{#if showNewSectionPopup}
    <Popup title="Create Section" submitText="Create" onSubmit={handleCreateSection} inputs={newSectionFormInput}></Popup>
{/if}

<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&icon_names=add,close,mic,stop" />
