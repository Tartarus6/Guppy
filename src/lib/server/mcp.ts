// Note: custom modelcontextprotocol sdk in use because main branch doesn't currently support zod v4
import { McpServer, ResourceTemplate } from "@socotra/modelcontextprotocol-sdk/server/mcp.js";
import { StdioServerTransport } from "@socotra/modelcontextprotocol-sdk/server/stdio.js";
import { z } from "zod";
import { db } from "./db";
import { sections, todos, userSettings, commandHistory } from './db/schema'
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
} from "./db/trpc";

// Create an MCP server
const server = new McpServer({
  name: "demo-server",
  version: "1.0.0"
});

// Addition tool
server.registerTool("add",
  {
    title: "Addition Tool",
    description: "Add two numbers",
    inputSchema: { a: z.number().nonoptional(), b: z.number().nonoptional() }
  },
  async ({ a, b }) => ({
    content: [{ type: "text", text: String(a + b) }]
  })
);

// Get Todos tool
server.registerTool("getTodos",
  {
    title: "Get Todos",
    description: "Get all todo items. Filter to include completed todos.",
    inputSchema: { sectionId: z.number(), includeCompleted: z.boolean().optional() },
  },
  async ({ sectionId, includeCompleted }) => ({
    content: [{ type: "text", text: JSON.stringify(await getTodos(sectionId, includeCompleted)) }]
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
    content: [{ type: "text", text: JSON.stringify(await getSections()) }]
  })
);

// Get Sections with Todos tool
server.registerTool("getSectionsWithTodos",
  {
    title: "Get Sections with Todos",
    description: "Get all sections with their associated todo items.",
    inputSchema: {}
  },
  async () => ({
    content: [{ type: "text", text: JSON.stringify(await getSectionsWithTodos()) }]
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
    content: [{ type: "text", text: JSON.stringify(await getSectionsWithTodosPriority()) }]
  })
);

// Create Section tool
server.registerTool("createSection",
  {
    title: "Create Section",
    description: "Create a new todo section.",
    inputSchema: { 
      name: z.string(),
      color: z.string().optional(),
      order: z.number().optional()
    }
  },
  async ({ name, color, order }) => ({
    content: [{ type: "text", text: JSON.stringify(await createSection({ name, color, order })) }]
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
      color: z.string().optional(),
      order: z.number().optional()
    }
  },
  async ({ id, name, color, order }) => {
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;
    if (order !== undefined) updates.order = order;
    
    return {
      content: [{ type: "text", text: JSON.stringify(await updateSection(id, updates)) }]
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
    content: [{ type: "text", text: JSON.stringify(await deleteSection(id, moveToSectionId)) }]
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
    content: [{ type: "text", text: JSON.stringify(await getTodoById(id)) }]
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
    content: [{ type: "text", text: JSON.stringify(await findTodosByText(text, sectionId)) }]
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
      content: [{ type: "text", text: JSON.stringify(await createTodo(todoData)) }]
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
      content: [{ type: "text", text: JSON.stringify(await updateTodo(id, updates)) }]
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
    content: [{ type: "text", text: JSON.stringify(await deleteTodo(id)) }]
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
    content: [{ type: "text", text: JSON.stringify(await moveTodos(todoIds, targetSectionId)) }]
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
    content: [{ type: "text", text: JSON.stringify(await markTodosCompleted(todoIds, completed)) }]
  })
);

// Set Todos Priority tool
server.registerTool("setTodosPriority",
  {
    title: "Set Todos Priority",
    description: "Set priority for multiple todos. Priority: -1 (low), 0 (medium), 1 (high).",
    inputSchema: { 
      todoIds: z.array(z.number()),
      priority: z.number()
    }
  },
  async ({ todoIds, priority }) => ({
    content: [{ type: "text", text: JSON.stringify(await setTodosPriority(todoIds, priority)) }]
  })
);

// Set Todos Due Date tool
server.registerTool("setTodosDueDate",
  {
    title: "Set Todos Due Date",
    description: "Set due date for multiple todos.",
    inputSchema: { 
      todoIds: z.array(z.number()),
      dueDate: z.string().optional() // ISO date string, null to clear
    }
  },
  async ({ todoIds, dueDate }) => ({
    content: [{ type: "text", text: JSON.stringify(await setTodosDueDate(todoIds, dueDate ? new Date(dueDate) : null)) }]
  })
);

// Add a dynamic greeting resource
server.registerResource(
  "greeting",
  new ResourceTemplate("greeting://{name}", { list: undefined }),
  { 
    title: "Greeting Resource",      // Display name for UI
    description: "Dynamic greeting generator"
  },
  async (uri, { name }) => ({
    contents: [{
      uri: uri.href,
      text: `Hello, ${name}!`
    }]
  })
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
console.log("mcp server running")