<script lang="ts">
    import type { TodoItem, TodoSectionWithTodosByPriority, NewTodoItem, NewTodoSection } from '$lib/server/db';
    import { todoService } from "$lib/client/todos";
	import { getSectionsContext } from "$lib/client/context.svelte";
    import TodoSectionContainer from "$lib/components/TodoSectionContainer.svelte";
    import Masonry from '$lib/components/Masonry.svelte';
    import { onMount } from "svelte";

    let sectionName = $state("section")

    // Get the sections context
    const sectionsContext = getSectionsContext()
</script>

<h1 class="text-center w-full">Guppy</h1>

<div class="">
    <h2>Sections:</h2>
    <div class="grid grid-cols-1 w-50 bg-slate-600">
        <h4>Create Section</h4>
        
        <span bind:textContent={sectionName} id="sectionName" class="min-w-16 inline-block border-2 border-amber-50" contenteditable="true"></span>
        
        <button aria-label="Create Section Button" onmousedown={() => {todoService.createSection(sectionsContext, {name: sectionName})}}>
            <div class="size-12 bg-yellow-500 active:bg-yellow-600"></div>
        </button>
    </div>
    <Masonry class='gap-4' stretchFirst={false}>
        {#each sectionsContext.sections as section}
            <div class="">
                <TodoSectionContainer section={section}></TodoSectionContainer>
            </div>
        {/each}
    </Masonry>
</div>