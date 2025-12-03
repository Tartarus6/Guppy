<script lang="ts">
	import { createSectionsContext, setSectionsContext } from '$lib/client/context.svelte';
	import { authService } from '$lib/client/auth';
	import { todoService } from '$lib/client/todos';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.png';

	let { children } = $props();

	// Create and set the sections context
	const sectionsContext = createSectionsContext()
	setSectionsContext(sectionsContext)

	// Check authentication on mount
	onMount(async () => {
		if (!authService.isAuthenticated()) {
			goto('/login');
			return;
		}
		
		await sectionsContext.refreshSections();
	})

	async function handleLogout() {
		await authService.logout();
		goto('/login');
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Guppy</title>
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&icon_names=add,close,mic,send,stop" />
</svelte:head>

<div class='p-4'>
	<div class='flex justify-between items-center mb-4'>
		<h1 class='text-2xl font-bold'>Guppy</h1>
		<div>
			<button 
				onclick={() => {
					todoService.undo(sectionsContext).then(() => {
						sectionsContext.refreshSections();
					});
					}}
				class='px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded transition-colors'
			>
				Undo
			</button>
			<button 
				onclick={handleLogout}
				class='px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors'
			>
				Logout
			</button>
		</div>
	</div>
	{@render children?.()}
</div>