<script lang="ts">
    interface Props {
        /** Whether the checkbox is checked */
        checked: boolean
        /** Whether the checkbox is disabled */
        disabled?: boolean  
        /** Additional CSS classes */
        class?: string
        /** Aria label for accessibility */
        ariaLabel?: string
        /** Whether to use a bigger size */
        big?: boolean
        /** Called when the checkbox state changes */
        onchange: (checked: boolean) => void | Promise<void>
    }

    let {
        checked,
        disabled = false, 
        class: className = '', 
        ariaLabel = 'checkbox',
        big = false,
        onchange
    }: Props = $props()
</script>

<button 
    type="button"
    onmousedown={(e) => {
        checked = !checked
        onchange(checked)
    }} 
    aria-label={ariaLabel}
    {disabled}
    class="inline-flex {className}"
>
    <div class="{big ? 'size-6' : 'size-5'} border-2 border-gray-300 rounded cursor-pointer transition-all duration-200 flex items-center justify-center {checked ? 'bg-blue-500 border-blue-500' : 'bg-white hover:border-blue-400'} {disabled ? 'opacity-50 cursor-not-allowed' : ''}">
        {#if checked}
            <svg class="text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
        {/if}
    </div>
</button>