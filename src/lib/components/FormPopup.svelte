<script lang="ts">
    interface Props {
        inputs: Form
        title: string
        submitText: String
        
        // Returns void to cancel
        onSubmit: (output: FormOutput) => (void|Promise<void>)
    }

    export type Form = {
        label: string
        value: string|number
        placeholder?: string
        required?: boolean
    }[]
    export type FormOutput = Form | void

    const { inputs, title, submitText, onSubmit }: Props = $props()

    let output = $state(inputs)
</script>

<div 
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    onclick={async (e) => {
        if (e.target === e.currentTarget) onSubmit()
    }}
    onkeydown={async (e) => {
        if (e.key === 'Escape') onSubmit()
    }}
    tabindex="-1"
>
    <div class="bg-hologram-700 border-2 border-hologram-300 p-6 w-96 max-w-full mx-4 rounded-3xl">
        <h3 id="modal-title" class="text-white mb-4">{title}</h3>
        <form onsubmit={async (e) => {
            e.preventDefault()
            onSubmit(output)
        }}>
            {#each output.keys() as i}
                {#if (typeof inputs[i].value == 'string')}
                    <div class="mb-4">
                        <label for="todoText" class="block text-white text-sm font-medium mb-2">{inputs[i].label}</label>
                        <input 
                            type="text" 
                            bind:value={output[i].value}
                            class="w-full px-3 py-2 bg-hologram-600 text-white border-2 border-hologram-500 focus:outline-none focus:border-green-500"
                            placeholder="{inputs[i].placeholder || ''}"
                            required={inputs[i].required ?? true}
                        />
                    </div>
                {:else if (typeof inputs[i].value == 'number')}
                    <div class="mb-6">
                        <label for="todoPriority" class="block text-white text-sm font-medium mb-2">{inputs[i].label}</label>
                            <input 
                                type="number" 
                                bind:value={output[i].value}
                                class="w-full"
                                required={inputs[i].required ?? true}
                            />
                    </div>
                {/if}
            {/each}
            <div class="flex gap-3 justify-end">
                <button 
                    type="button"
                    class="px-4 py-2 bg-hologram-600 text-white hover:bg-hologram-500 transition-colors"
                    onmousedown={async () => onSubmit()}
                >
                    Cancel
                </button>
                <button 
                    type="submit" class="px-4 py-2 bg-green-600 text-white hover:bg-green-700 transition-colors">
                    {submitText}
                </button>
            </div>
        </form>
    </div>
</div>
