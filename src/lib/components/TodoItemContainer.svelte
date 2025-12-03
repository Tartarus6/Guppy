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

    // Optimistic UI state - starts with the todo's actual completed state
    let optimisticCompleted = $state(props.todo.completed)

    // Update optimistic state when the underlying todo changes
    $effect(() => {
        optimisticCompleted = props.todo.completed
    })

    async function handleCheckboxChange(newChecked: boolean) {
        // Immediately update the UI optimistically
        optimisticCompleted = newChecked
        // Then update the server
        await todoService.updateTodo(sectionsContext, props.todo.id, {completed: newChecked})
    }
</script>

<div class='bg-hologram-600 flex flex-row rounded-lg'>
    <div class="mr-3 place-items-center flex">
        <Checkbox 
            checked={optimisticCompleted} 
            onchange={handleCheckboxChange}
            ariaLabel="Mark todo as complete"
            big={props.big}
        />
    </div>
    <span class='font-bold {props.big ? 'text-lg' : ''} {optimisticCompleted ? 'line-through text-hologram-400' : ''}'>{props.todo.text}</span>
    <DeleteButton onmousedown={async () => {
        await todoService.deleteTodo(sectionsContext, props.todo.id)
    }}></DeleteButton>
</div>