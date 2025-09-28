<script lang="ts">
    import type { TodoItem } from "$lib/server/db";
    import { todoService } from "$lib/client/todos";
	import { getSectionsContext } from "$lib/client/context.svelte";
    import Checkbox from "./Checkbox.svelte";
	import DeleteButton from "./DeleteButton.svelte";

    interface Props {
        todo: TodoItem
    }
    let { todo }: Props = $props()

    let sectionsContext = getSectionsContext()

    async function handleCheckboxChange(newChecked: boolean) {
        await todoService.updateTodo(sectionsContext, todo.id, {completed: newChecked})
    }
</script>

<div class='bg-slate-600 flex flex-row rounded-lg'>
    <div class="mr-3 place-items-center flex">
        <Checkbox 
            checked={todo.completed} 
            onchange={handleCheckboxChange}
            ariaLabel="Mark todo as complete"
        />
    </div>
    <span class='font-bold {todo.completed ? 'line-through text-gray-400' : ''}'>{todo.text}</span>
    <DeleteButton onmousedown={async () => {
        await todoService.deleteTodo(sectionsContext, todo.id)
    }}></DeleteButton>
</div>