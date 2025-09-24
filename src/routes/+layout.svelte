<script lang="ts">
	import { createSectionsContext, setSectionsContext } from '$lib/client/context.svelte';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
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
</svelte:head>

<div class='p-4'>
	{@render children?.()}
</div>