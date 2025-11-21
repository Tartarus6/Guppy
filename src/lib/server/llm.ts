import { groq } from '@ai-sdk/groq';
import Groq from 'groq-sdk';
import { experimental_createMCPClient, generateText, type experimental_MCPClient, stepCountIs, Output, experimental_generateSpeech as generateSpeech } from 'ai';
import { InMemoryTransport } from '@socotra/modelcontextprotocol-sdk/inMemory.js';
import fs from 'fs'
import { getSections } from '$lib/server/db/trpc';
import { env } from '$env/dynamic/private';
import { createMCPServer } from './mcp.js';

const voiceLlm = new Groq({
    apiKey: env.GROQ_API_KEY
})

// MCP Client cache per session
const mcpClients = new Map<string, experimental_MCPClient>();

async function initializeMCPClient(sessionId: string): Promise<experimental_MCPClient> {
    // Check if we already have a client for this session
    const existingClient = mcpClients.get(sessionId);
    if (existingClient) {
        return existingClient;
    }

    try {
        // Create in-memory transport pair (no separate process needed)
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
        
        // Start the MCP server with the server-side transport, bound to this session
        const server = createMCPServer(sessionId);
        await server.connect(serverTransport);
        
        // Create client with the client-side transport
        const mcpClient = await experimental_createMCPClient({
            transport: clientTransport
        });

        // Cache the client for this session
        mcpClients.set(sessionId, mcpClient);

        console.log(`MCP Client connected successfully for session ${sessionId.substring(0, 8)}...`);
        return mcpClient;
    } catch (error) {
        console.error("Failed to initialize MCP client:", error);
        throw error;
    }
}

export async function sendLLMMessage(humanMessage: string, sessionId: string) {
    const systemMessage = `You are the LLM in charge of interfacing with a todo app.
You should take requests from the user and either complete the task, or retrieve the requested information and respond to the user.
When running tool calls, make the names are correct (for example, "getSections" is correct, and "getSections:" is incorrect)
In order to complete your tasks, feel free to make inferences. For example, you can decide yourself which section to put a new todo item in based on context.
Also feel free to readily create new sections. If asked to make some grocery todos, create a grocery section if one doesnt exist.
Give your responses as though they are spoken word and keep them simply formatted. When asked for information, provide only the information with no additional questions or details.
The commands you are given might be poorly transcripted from audio, so words like "toodles" might actually be "todos".`
    try {
        const mcpClient = await initializeMCPClient(sessionId);
        
        const tools = await mcpClient.tools();
        
        const result = await generateText({
            model: groq(env.LLM_MODEL),
            system: systemMessage + `\n\nCurrent todo sections: ${JSON.stringify(await getSections(sessionId))}\n\nAvailable MCP tools: ${Object.keys(tools)}`,
            prompt: humanMessage,
            tools,
            stopWhen: stepCountIs(7)
        });
        
        // Extract the final text from the result
        // The AI SDK should put the final text in result.text, but let's check alternative locations
        let finalText = result.text;
        
        if (!finalText) {
            // From your JSON output, the final text might be in the messages array
            const messages = (result as any).messages;
            if (messages && Array.isArray(messages)) {
                // Find the last assistant message with text content
                for (let i = messages.length - 1; i >= 0; i--) {
                    const message = messages[i];
                    if (message.role === 'assistant' && Array.isArray(message.content)) {
                        const textContent = message.content.find((content: any) => content.type === 'text');
                        if (textContent?.text) {
                            finalText = textContent.text;
                            break;
                        }
                    }
                }
            }
        }
        
        if (!finalText) {
            // Check if it's in the response body (alternative location)
            const responseContent = (result as any).response?.body?.choices?.[0]?.message?.content;
            if (responseContent) {
                finalText = responseContent;
            }
        }
                
        return {
            ...result,
            text: finalText || 'No text response generated'
        };
    } catch (error) {
        console.error("Error in sendLLMMessage:", error);
        
        return null
    }
}

export async function getSpeech(text: string) {
    const speechFilePath = "data/speech.wav";
    const model = "playai-tts";
    const voice = "Mikail-PlayAI";
    const responseFormat = "wav";

    const response = await voiceLlm.audio.speech.create({
        model,
        voice,
        input: text,
        response_format: responseFormat
    })

    const buffer = Buffer.from(await response.arrayBuffer())
    await fs.promises.writeFile(speechFilePath, buffer)
    
    // Return the audio data as base64 so it can be played in the browser
    return {
        audioData: buffer.toString('base64'),
        mimeType: 'audio/wav',
        filePath: speechFilePath
    }
}

export async function getText() {
    const filePath = 'data/message.wav'
    const model = 'whisper-large-v3-turbo'

    const transcription = voiceLlm.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model,
    })

    return transcription
}
