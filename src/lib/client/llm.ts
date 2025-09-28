import { trpc } from '.';
import type { SectionsContext } from './context.svelte';

class LlmService {
    async sendMessage(sectionsContext: SectionsContext, humanMessage: string) {
        const response = await trpc.llmMessage.query(humanMessage)
        sectionsContext.refreshSections()
        return response
    }
}

export const llmService = new LlmService