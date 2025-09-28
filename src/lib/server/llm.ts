import { groq } from '@ai-sdk/groq';
import { experimental_createMCPClient, generateText, type experimental_MCPClient, type GenerateTextResult, type ToolSet, stepCountIs, Output } from 'ai';
import { StdioClientTransport } from '@socotra/modelcontextprotocol-sdk/client/stdio.js';
import envProps from './envProps';

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
In order to complete your tasks, feel free to make inferences. For example, you can decide yourself which section to put a new todo item in based on context.`
    try {
        await initializeMCPClient();
        
        const result = await generateText({
            model: groq(envProps.LLM_MODEL),
            system: systemMessage,
            prompt: humanMessage,
            tools: await mcpClient.tools(),
            stopWhen: stepCountIs(5)
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
        
        console.log('Final text extracted:', finalText ? 'Found' : 'Not found');
        console.log('Result.text:', result.text ? 'Present' : 'Undefined');
        
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
