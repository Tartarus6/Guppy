<script lang="ts">
    import { authService } from '$lib/client/auth';
    import { goto } from '$app/navigation';
    
    let username = $state('');
    let password = $state('');
    let errorMessage = $state('');
    let loading = $state(false);

    async function handleLogin(e: Event) {
        e.preventDefault()
        loading = true;
        errorMessage = '';
        
        try {
            const success = await authService.login(username, password);
            
            if (success) {
                // Redirect to home page on success
                goto('/todos');
            } else {
                errorMessage = 'Invalid username or password';
            }
        } catch (error) {
            console.error('Login error:', error);
            errorMessage = 'An error occurred during login';
        } finally {
            loading = false;
        }
    }
</script>

<div class='w-full h-full'>
    <div class='m-auto max-w-256'>
        <div class="w-full">
            <div class='bg-hologram-700 border-2 border-hologram-300 rounded-2xl overflow-clip'>
                <div class="p-1 flex w-full flex-col gap-2">
                    <h1 class="text-center">Login to Guppy</h1>
                    <form onsubmit={handleLogin}>
                        <label for="username" class="text-gray-200 font-medium mb-2">Username</label>
                        <input 
                            type="text" 
                            id="username" 
                            bind:value={username}
                            class="w-full px-3 py-2 mb-4 bg-hologram-600 text-white border border-hologram-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            required
                        />
                        <label for="password" class="text-gray-200 font-medium mb-2">Password</label>
                        <input 
                            type="password" 
                            id="password" 
                            bind:value={password}
                            class="w-full px-3 py-2 mb-4 bg-hologram-600 text-white border border-hologram-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            required
                        />
                        {#if errorMessage}
                            <p class="text-red-500 mb-4">{errorMessage}</p>
                        {/if}
                        <div class="flex justify-center">
                            <button 
                                type="submit" 
                                class="px-4 py-2 bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                                disabled={loading}
                            >
                                {#if loading}
                                    Logging in...
                                {:else}
                                    Login
                                {/if}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>