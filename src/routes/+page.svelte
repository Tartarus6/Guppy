<script lang="ts">
    import { authService } from '$lib/client/auth';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';

    onMount(() => {
        // Redirect based on authentication status
        if (authService.isAuthenticated()) {
            goto('/todos');
        } else {
            goto('/login');
        }
    });
</script>

<div class='bg-hologram-700 border-2 border-hologram-300 rounded-2xl overflow-clip'>
    <div class='p-1 flex w-full flex-col gap-2'>
        <h2>Redirecting...</h2>
    </div>
</div>
