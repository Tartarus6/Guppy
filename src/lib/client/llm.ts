import { trpc } from '.';
import type { SectionsContext } from '$lib/client/context.svelte';

class LlmService {
    async sendMessage(sectionsContext: SectionsContext, humanMessage: string) {
        const response = await trpc.llmMessage.query(humanMessage)
        sectionsContext.refreshSections()
        return response
    }

    async textToSpeech(text: string) {
        const response = await trpc.textToSpeech.query(text)
        return response
    }

    async speechToText() {
        return await trpc.speechToText.query()
    }

    async saveAudio(audioBase64: string) {
        return await trpc.saveAudio.mutate(audioBase64)
    }
}

export const llmService = new LlmService