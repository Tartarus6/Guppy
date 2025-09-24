<script lang="ts">
    import type { TodoItem, TodoSectionWithTodosByPriority, NewTodoItem, NewTodoSection } from '$lib/server/db';
    import { todoService } from "$lib/client/todos";
	import { getSectionsContext } from "$lib/client/context.svelte";
    import TodoSectionContainer from "$lib/components/TodoSectionContainer.svelte";
    import { onMount } from "svelte";

    let sectionName = $state("section")

    // Get the sections context
    const sectionsContext = getSectionsContext()
</script>

<h1 class="text-center w-full">Guppy</h1>

<div class="grid grid-cols-1">
    <h2>Refresh Sections</h2>
        
    <button aria-label="Create Section Button" onmousedown={sectionsContext.refreshSections}>
        <div class="size-12 bg-yellow-500 active:bg-yellow-600"></div>
    </button>
</div>

<div class="grid grid-cols-1">
    <h2>Print Sections</h2>
        
    <button aria-label="Create Section Button" onmousedown={() => {console.log($state.snapshot(sectionsContext.sections))}}>
        <div class="size-12 bg-yellow-500 active:bg-yellow-600"></div>
    </button>
</div>

<div class="border-2 border-red-500 w-full">
    <h2>Sections:</h2>
    <div class="grid grid-cols-1 w-50 bg-slate-600">
        <h2>Create Section</h2>
        
        <span bind:textContent={sectionName} id="sectionName" class="min-w-16 inline-block border-2 border-amber-50" contenteditable="true"></span>
        
        <button aria-label="Create Section Button" onmousedown={() => {todoService.createSection(sectionsContext, {name: sectionName})}}>
            <div class="size-12 bg-yellow-500 active:bg-yellow-600"></div>
        </button>
    </div>
    <div class='grid gap-4 w-full place-items-center p-4'>
        {#each sectionsContext.sections as section}
            <div class="w-[80%]">
                <TodoSectionContainer section={section}></TodoSectionContainer>
            </div>
        {/each}
    </div>
</div>