<script lang="ts">
    import type { TodoItem, TodoSectionWithTodosByPriority, NewTodoItem, NewTodoSection } from '$lib/server/db';
    import { todoService } from '$lib/client/todos';

    import TodoItemContainer from './TodoItemContainer.svelte';

    interface Props {
        section: TodoSectionWithTodosByPriority
    }
    const { section }: Props = $props()

    let todoText = $state("todo")
    let todoPriority = $state(0)
</script>

<div class='bg-slate-700 w-full'>
    <div class='p-4 grid grid-cols-1 gap-4'>
        <h2>{section.name}</h2>
        <div class="grid grid-cols-1 border-2 border-red-500">
            <h3>Create TODO</h3>
            
            <span bind:textContent={todoText} id="sectionName" class="inline-block border-2 border-amber-50" contenteditable="true"></span>
            <input bind:value={todoPriority} type="number" class="inline-block border-2 border-amber-50">

            <button aria-label="create todo button" onmousedown={async () => {await todoService.createTodo({text: todoText, priority: todoPriority, sectionId: section.id, completed: false})}}>
                <div class="size-12 bg-yellow-500 active:bg-yellow-600"></div>
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