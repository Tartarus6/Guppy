<script lang="ts">
	import { createSectionsContext, setSectionsContext } from '$lib/client/context.svelte';
	import '../app.css';
	import favicon from '$lib/assets/favicon.png';
	import { onMount } from 'svelte';

	let { children } = $props();

	// Create and set the sections context
	const sectionsContext = createSectionsContext()
	setSectionsContext(sectionsContext)

	onMount(async () => {
		await sectionsContext.refreshSections();
	})
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Guppy</title>
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&icon_names=add,close,mic,send,stop" />
</svelte:head>

<div class='p-4'>
	{@render children?.()}
</div>