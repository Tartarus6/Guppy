<script lang="ts">
    interface Props {
        onmousedown: () => void | Promise<void>
    }

    const { onmousedown } = $props()
</script>

<button class='flex' aria-label="add button" onmousedown={onmousedown}>
    <div class='flex h-fit bg-green-600 hover:bg-green-700 active:bg-green-800 rounded-full'>
        <span class="material-symbols-outlined">
            add
        </span>
    </div>
</button>
