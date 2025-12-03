<script lang="ts">
	import type { Snippet } from "svelte";

    interface Props {
        children: Snippet;
        onSubmit: () => (void|Promise<void>)
    }

    let props: Props = $props();
</script>

<form onsubmit={async (e) => {e.preventDefault(); props.onSubmit(); console.log(e);}}>
    <div class="fixed inset-0 bg-hologram-900 flex items-center justify-center z-50"
        role="dialog"
        tabindex="-1"
        aria-modal="true"
        aria-labelledby="modal-title"
        onmousedown={async (e) => {
            if (e.target === e.currentTarget) props.onSubmit()
        }}
        onkeydown={async (e) => {
            if (e.key === 'Escape') props.onSubmit()
        }}>
        <div class="m-6 max-w-[80%] max-h-192 w-full h-fit  overflow-y-scroll mx-4 rounded-3xl">
            {@render props.children()}
        </div>
    </div>
</form>
