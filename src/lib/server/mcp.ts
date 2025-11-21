// Note: custom modelcontextprotocol sdk in use because main branch doesn't currently support zod v4
import { McpServer, ResourceTemplate } from "@socotra/modelcontextprotocol-sdk/server/mcp.js";
import { StdioServerTransport } from "@socotra/modelcontextprotocol-sdk/server/stdio.js";
import { z } from "zod";
import { 
  getSections, 
  getTodos, 
  getSectionsWithTodos, 
  getSectionsWithTodosPriority,
  createSection,
  updateSection,
  deleteSection,
  getTodoById,
  findTodosByText,
  createTodo,
  updateTodo,
  deleteTodo,
  moveTodos,
  markTodosCompleted,
  setTodosPriority,
  setTodosDueDate
} from '$lib/server/db/trpc';

export function createMCPServer(sessionId: string) {
  // Create an MCP server
  const server = new McpServer({
    name: "demo-server",
    version: "1.0.0"
  });

  // Get Todos tool
  server.registerTool("getTodos",
    {
      title: "Get Todos",
      description: "Get all todo items. Filter to include completed todos.",
      inputSchema: { sectionId: z.number(), includeCompleted: z.boolean().optional() },
    },
    async ({ sectionId, includeCompleted }) => ({
      content: [{ type: "text", text: JSON.stringify(await getTodos(sessionId, sectionId, includeCompleted)) }]
    })
  );

  // Get Sections tool
  server.registerTool("getSections",
    {
      title: "Get Sections",
      description: "Get all todo sections.",
      inputSchema: {}
    },
    async () => ({
      content: [{ type: "text", text: JSON.stringify(await getSections(sessionId)) }]
    })
  );

  // Get Sections with Todos by Priority tool
  server.registerTool("getSectionsWithTodosPriority",
    {
      title: "Get Sections with Todos by Priority",
      description: "Get all sections with their todos grouped by priority levels.",
      inputSchema: {}
    },
    async () => ({
      content: [{ type: "text", text: JSON.stringify(await getSectionsWithTodosPriority(sessionId)) }]
    })
  );

  // Create Section tool
  server.registerTool("createSection",
    {
      title: "Create Section",
      description: "Create a new todo section.",
      inputSchema: { 
        name: z.string(),
        order: z.number().optional()
      }
    },
    async ({ name, order }) => ({
      content: [{ type: "text", text: JSON.stringify(await createSection(sessionId, { name, order })) }]
    })
  );

  // Update Section tool
  server.registerTool("updateSection",
    {
      title: "Update Section",
      description: "Update an existing todo section.",
      inputSchema: { 
        id: z.number(),
        name: z.string().optional(),
        order: z.number().optional()
      }
    },
    async ({ id, name, order }) => {
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (order !== undefined) updates.order = order;
      
      return {
        content: [{ type: "text", text: JSON.stringify(await updateSection(sessionId, id, updates)) }]
      };
    }
  );

  // Delete Section tool
  server.registerTool("deleteSection",
    {
      title: "Delete Section",
      description: "Delete a todo section, optionally moving its todos to another section.",
      inputSchema: { 
        id: z.number(),
        moveToSectionId: z.number().optional()
      }
    },
    async ({ id, moveToSectionId }) => ({
      content: [{ type: "text", text: JSON.stringify(await deleteSection(sessionId, id, moveToSectionId)) }]
    })
  );

  // Get Todo by ID tool
  server.registerTool("getTodoById",
    {
      title: "Get Todo by ID",
      description: "Get a specific todo item by its ID.",
      inputSchema: { id: z.number() }
    },
    async ({ id }) => ({
      content: [{ type: "text", text: JSON.stringify(await getTodoById(sessionId, id)) }]
    })
  );

  // Find Todos by Text tool
  server.registerTool("findTodosByText",
    {
      title: "Find Todos by Text",
      description: "Find todo items by searching their text content.",
      inputSchema: { 
        text: z.string(),
        sectionId: z.number().optional()
      }
    },
    async ({ text, sectionId }) => ({
      content: [{ type: "text", text: JSON.stringify(await findTodosByText(sessionId, text, sectionId)) }]
    })
  );

  // Create Todo tool
  server.registerTool("createTodo",
    {
      title: "Create Todo",
      description: "Create a new todo item.",
      inputSchema: { 
        text: z.string(),
        sectionId: z.number(),
        priority: z.number().optional(),
        order: z.number().optional(),
        dueDate: z.string().optional() // ISO date string
      }
    },
    async ({ text, sectionId, priority, order, dueDate }) => {
      const todoData: any = { 
        text, 
        sectionId, 
        completed: false,
        priority: priority ?? 0,
        order: order ?? 0
      };
      if (dueDate) {
        todoData.dueDate = new Date(dueDate);
      }
      
      return {
        content: [{ type: "text", text: JSON.stringify(await createTodo(sessionId, todoData)) }]
      };
    }
  );

  // Update Todo tool
  server.registerTool("updateTodo",
    {
      title: "Update Todo",
      description: "Update an existing todo item.",
      inputSchema: { 
        id: z.number(),
        text: z.string().optional(),
        completed: z.boolean().optional(),
        priority: z.number().optional(),
        sectionId: z.number().optional(),
        order: z.number().optional(),
        dueDate: z.string().optional() // ISO date string
      }
    },
    async ({ id, text, completed, priority, sectionId, order, dueDate }) => {
      const updates: any = {};
      if (text !== undefined) updates.text = text;
      if (completed !== undefined) updates.completed = completed;
      if (priority !== undefined) updates.priority = priority;
      if (sectionId !== undefined) updates.sectionId = sectionId;
      if (order !== undefined) updates.order = order;
      if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
      
      return {
        content: [{ type: "text", text: JSON.stringify(await updateTodo(sessionId, id, updates)) }]
      };
    }
  );

  // Delete Todo tool
  server.registerTool("deleteTodo",
    {
      title: "Delete Todo",
      description: "Delete a todo item.",
      inputSchema: { id: z.number() }
    },
    async ({ id }) => ({
      content: [{ type: "text", text: JSON.stringify(await deleteTodo(sessionId, id)) }]
    })
  );

  // Move Todos tool
  server.registerTool("moveTodos",
    {
      title: "Move Todos",
      description: "Move multiple todos to a different section.",
      inputSchema: { 
        todoIds: z.array(z.number()),
        targetSectionId: z.number()
      }
    },
    async ({ todoIds, targetSectionId }) => ({
      content: [{ type: "text", text: JSON.stringify(await moveTodos(sessionId, todoIds, targetSectionId)) }]
    })
  );

  // Mark Todos Completed tool
  server.registerTool("markTodosCompleted",
    {
      title: "Mark Todos Completed",
      description: "Mark multiple todos as completed or incomplete.",
      inputSchema: { 
        todoIds: z.array(z.number()),
        completed: z.boolean()
      }
    },
    async ({ todoIds, completed }) => ({
      content: [{ type: "text", text: JSON.stringify(await markTodosCompleted(sessionId, todoIds, completed)) }]
    })
  );

  return server;
}

// For standalone execution (if you still want that option)
export async function runMCP() {
  // Note: standalone mode would need a proper authentication mechanism
  const server = createMCPServer('standalone-session');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("mcp server running");
}

// Only run standalone if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMCP();
}
