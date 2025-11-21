<script lang="ts">
    import type { TodoItem } from "$lib/server/db";
    import { todoService } from "$lib/client/todos";
	import { getSectionsContext } from "$lib/client/context.svelte";
    import Checkbox from "./Checkbox.svelte";
	import DeleteButton from "./DeleteButton.svelte";

    interface Props {
        todo: TodoItem;
        big: boolean;
    }
    let props: Props = $props()

    let sectionsContext = getSectionsContext()

    async function handleCheckboxChange(newChecked: boolean) {
        await todoService.updateTodo(sectionsContext, props.todo.id, {completed: newChecked})
    }
</script>

<div class='bg-hologram-600 flex flex-row rounded-lg'>
    <div class="mr-3 place-items-center flex">
        <Checkbox 
            checked={props.todo.completed} 
            onchange={handleCheckboxChange}
            ariaLabel="Mark todo as complete"
            big={props.big}
        />
    </div>
    <span class='font-bold {props.big ? 'text-lg' : ''} {props.todo.completed ? 'line-through text-hologram-400' : ''}'>{props.todo.text}</span>
    <DeleteButton onmousedown={async () => {
        await todoService.deleteTodo(sectionsContext, props.todo.id)
    }}></DeleteButton>
</div>