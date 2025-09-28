<script lang="ts">
    import type { TodoItem, TodoSectionWithTodosByPriority, NewTodoItem, NewTodoSection } from '$lib/server/db';
    import { getSectionsContext } from '$lib/client/context.svelte';
    import { todoService } from '$lib/client/todos';
    import TodoItemContainer from './TodoItemContainer.svelte';
    import Popup from './Popup.svelte';
    import type { Form, FormOutput } from './Popup.svelte';

    let sectionsContext = getSectionsContext()

    interface Props {
        section: TodoSectionWithTodosByPriority
    }
    const { section }: Props = $props()

    let showPopup = $state(false)

    // Must be of type `Form`
    let formInput: Form = [
        {
            label: "Todo Text",
            value: "",
            placeholder: "Enter todo text"
        },
        {
            label: "Priority",
            value: 0
        }
    ]

    async function handleCreateTodo(output: FormOutput) {
        if (output) {
            if (typeof output[0].value == 'string' && typeof output[1].value == 'number') {
                await todoService.createTodo(sectionsContext, {
                    text: output[0].value,
                    priority: output[1].value,
                    sectionId: section.id, 
                    completed: false
                })
            }
        }

        showPopup = false
    }
</script>

<div class='bg-slate-700 w-full'>
    <div class='p-4 grid grid-cols-1 gap-4'>
        <div class='flex flex-row gap-4'>
            <h2 class=' break-normal'>{section.name}</h2>
            <button 
                class="flex size-8 bg-green-600 hover:bg-green-700 active:bg-green-800 transition-colors"
                aria-label="add todo button" 
                onmousedown={() => showPopup = true}
            >
                <svg class="text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
            </button>
            <button class='flex ml-auto' aria-label="delete section button" onmousedown={async () => {
                await todoService.deleteSection(sectionsContext, section.id)
                }}>
                <div class='size-4 bg-red-600'></div>
            </button>
        </div>
    
        <div class='grid grid-cols-1 gap-4'>
            {#each (Object.keys(section.priorities) as string[]).map(Number).sort((a, b) => b-a) as priority}
                <div>
                    <h3>Priority: {priority}</h3>
                    <div class='grid grid-cols-1 gap-1'>
                        {#each section.priorities[priority] as todo}
                            <TodoItemContainer todo={todo}></TodoItemContainer>
                        {/each}
                    </div>
                </div>
            {/each}
        </div>
    </div>
</div>

<!-- Modal/Popup -->
{#if showPopup}
    <Popup inputs={formInput} title="Create TODO" submitText="Create" onSubmit={handleCreateTodo}></Popup>
{/if}