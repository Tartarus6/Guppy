import { trpc } from '.';

class LlmService {
    async sendMessage(systemMessage: string, humanMessage: string) {
        const response = await trpc.llmMessage.query({systemMessage, humanMessage})

        return response
    }
}

export const llmService = new LlmService