<script lang="ts">
    interface Props {
        onmousedown: () => void | Promise<void>
    }

    const { onmousedown } = $props()
</script>

<button class='flex ml-auto' aria-label="delete button" onmousedown={onmousedown}>
    <div class='flex h-fit hover:text-red-500'>
        <span class="material-symbols-outlined">
            close
        </span>
    </div>
</button>
