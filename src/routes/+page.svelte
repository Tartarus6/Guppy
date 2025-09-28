<script lang="ts">
    import type { TodoItem, TodoSectionWithTodosByPriority, NewTodoItem, NewTodoSection } from '$lib/server/db';
    import { todoService } from "$lib/client/todos";
    import { llmService } from '$lib/client/llm';
	import { getSectionsContext } from "$lib/client/context.svelte";
    import TodoSectionContainer from "$lib/components/TodoSectionContainer.svelte";
    import Popup from '$lib/components/Popup.svelte';
    import type { Form, FormOutput } from '$lib/components/Popup.svelte';

    // Get the sections context
    const sectionsContext = getSectionsContext()

    let userMessage = $state("")
    let llmMessage = $state("")
    let llmThinkingStatus: 'done' | 'thinking' | 'error' = $state("done")

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

    async function submitChatMessage() {
        console.log(userMessage)
        llmThinkingStatus = 'thinking'
        try {
            let response = await llmService.sendMessage(sectionsContext, userMessage)
            llmThinkingStatus = 'done'
            userMessage = ''
            console.log(response)
            llmMessage = response.text || ""
        } catch (e) {
            llmThinkingStatus = 'error'
        }
    }
</script>

<h1 class="text-center w-full">Guppy</h1>

<div class='flex w-full flex-col gap-2 bg-slate-700'>
    <div class='flex place-self-start'>
        <form onsubmit={async (e) => {
            e.preventDefault()

            await submitChatMessage()
        }}>
            <input type="text" placeholder="Send a message to the LLM..." bind:value={userMessage} class='px-3 py-2 bg-slate-600 text-white border border-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent'>
            <button type='submit' class='px-4 py-2 bg-green-600 text-white hover:bg-green-700 transition-colors'>
                <span>Send</span>
            </button>
        </form>
    </div>
    <div class='flex place-self-end'>
        <!-- Thinking status indicator -->
		<div class="flex items-center place-self-start">
			{#if llmThinkingStatus === 'thinking'}
				<span class="flex items-center gap-1 text-yellow-400" title="Saving...">
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
				<span class="flex items-center gap-1 text-green-400" title="Saved">
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
				<span class="flex items-center gap-1 text-red-400" title="Error saving">
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
        <span class='px-3 py-2 bg-slate-600 text-white border border-slate-500'>{llmMessage || ''}</span>
    </div>
</div>

<div class='flex flex-row place-items-center gap-4'>
    <h2>Sections:</h2>
    <button 
        class="flex items-center justify-center size-8 bg-green-600 hover:bg-green-700 active:bg-green-800 transition-colors"
        aria-label="add todo button" 
        onmousedown={() => showNewSectionPopup = true}
    >
        <svg class="text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
        </svg>
    </button>
</div>

<div class='flex flex-row flex-wrap gap-4'>
    {#each sectionsContext.sections as section}
        <div class="flex min-w-70 flex-1">
            <TodoSectionContainer section={section}></TodoSectionContainer>
        </div>
    {/each}
</div>

{#if showNewSectionPopup}
    <Popup title="Create Section" submitText="Create" onSubmit={handleCreateSection} inputs={newSectionFormInput}></Popup>
{/if}
