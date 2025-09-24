<script lang="ts">
    import type { TodoItem } from "$lib/server/db";
    import { todoService } from "$lib/client/todos";
    import Checkbox from "./Checkbox.svelte";

    interface Props {
        todo: TodoItem
    }
    let { todo }: Props = $props()

    async function handleCheckboxChange(newChecked: boolean) {
        console.log(todo.text + ": " + newChecked)
        // TODO: update database
        await todoService.updateTodo(todo.id, {completed: newChecked})
    }
</script>

<div class='bg-slate-600 flex flex-row'>
    <div class="mr-3 place-items-center flex">
        <Checkbox 
            checkedInitial={todo.completed} 
            onchange={handleCheckboxChange}
            ariaLabel="Mark todo as complete"
        />
    </div>
    <span class='font-bold'>{todo.text}</span>
    <button class='ml-auto' aria-label="delete todo button" onmousedown={async () => {todoService.deleteTodo(todo.id)}}>
        <div class='size-4 bg-red-600'></div>
    </button>
</div>