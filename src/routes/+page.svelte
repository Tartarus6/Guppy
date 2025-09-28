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

    let llmFormInput: Form = [
        {
            label: "System Text",
            value: `You are the LLM in charge of interfacing with a todo app.
You should take requests from the user and either complete the task, or retrieve the requested information and respond to the user.
In order to complete your tasks, feel free to make inferences. For example, you can decide yourself which section to put a new todo item in based on context.`,
            placeholder: "Enter system text...",
            required: false
        },
        {
            label: "Human Text",
            value: "What todos currently exist?",
            placeholder: "Enter human text..."
        }
    ]
    let showLlmPopup = $state(false)
    async function handleLlm(output: FormOutput) {
        if (output) {
            if (typeof output[0].value == 'string' && typeof output[1].value == 'string') {
                let response = await llmService.sendMessage(output[0].value, output[1].value)

                
                console.log(JSON.stringify(response))
                console.log(response)
            }
        }

        showLlmPopup = false
    }
</script>

<h1 class="text-center w-full">Guppy</h1>

<button 
    class="flex items-center justify-center size-8 bg-green-600 hover:bg-green-700 active:bg-green-800 transition-colors"
    aria-label="add todo button" 
    onmousedown={() => showLlmPopup = true}
>
    <svg class="text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
    </svg>
</button>

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
{#if showLlmPopup}
    <Popup title="LLM Interface" submitText="Send" onSubmit={handleLlm} inputs={llmFormInput}></Popup>
{/if}
