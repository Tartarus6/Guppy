import { groq } from '@ai-sdk/groq';
import Groq from 'groq-sdk';
import { experimental_createMCPClient, generateText, type experimental_MCPClient, stepCountIs, Output, experimental_generateSpeech as generateSpeech } from 'ai';
import { StdioClientTransport } from '@socotra/modelcontextprotocol-sdk/client/stdio.js';
import fs from 'fs'
import envProps from './envProps';
import { getSections } from './db/trpc';

const voiceLlm = new Groq({
    apiKey: envProps.GROQ_API_KEY
})

// MCP Client for connecting to our MCP server
let mcpClient: experimental_MCPClient;

async function initializeMCPClient(): Promise<experimental_MCPClient> {
    if (mcpClient) {
        return mcpClient;
    }

    try {
        // Create transport to connect to MCP server via stdio
        const transport = new StdioClientTransport({
            command: 'npx',
            args: ['tsx', 'src/lib/server/mcp.ts'],
            cwd: process.cwd()
        });

        mcpClient = await experimental_createMCPClient({
            transport
        })

        // await mcpClient.connect(transport);
        console.log("MCP Client connected successfully");
        return mcpClient;
    } catch (error) {
        console.error("Failed to initialize MCP client:", error);
        throw error;
    }
}

export async function sendLLMMessage(humanMessage: string) {
    const systemMessage = `You are the LLM in charge of interfacing with a todo app.
You should take requests from the user and either complete the task, or retrieve the requested information and respond to the user.
When running tool calls, make the names are correct (for example, "getSections" is correct, and "getSections:" is incorrect)
In order to complete your tasks, feel free to make inferences. For example, you can decide yourself which section to put a new todo item in based on context.
Give your responses as though they are spoken word and keep them simply formatted. When asked for information, provide only the information with no additional questions or details.
The commands you are given might be poorly transcripted from audio, so words like "toodles" might actually be "todos".`
    try {
        await initializeMCPClient();
        
        const tools = await mcpClient.tools();
        
        const result = await generateText({
            model: groq(envProps.LLM_MODEL),
            system: systemMessage + `\n\nCurrent todo sections: ${JSON.stringify(await getSections())}\n\nAvailable MCP tools: ${Object.keys(tools)}`,
            prompt: humanMessage,
            tools,
            stopWhen: stepCountIs(6)
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
        
        // Fallback to basic generation without MCP
        const result = await generateText({
            model: groq(envProps.LLM_MODEL),
            system: systemMessage,
            prompt: humanMessage,
            experimental_output: Output.text()
        });
        
        return result;
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
