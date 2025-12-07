## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
# Starting the full stack (web + integrated server)
npm run dev

# Optional (to open the page upon running): npm run dev -- --open
```

### Running Server Separately

For mobile apps or distributed deployments, you can run the server standalone:

```sh
# Run the standalone tRPC server
npm run server
```

Then configure your client app to connect to the server URL in `.env`:
```env
PUBLIC_SERVER_URL=http://your-server-ip:3000
```

### Database Management
If changes are made to the schema, the `.db` file will need to be updated.
To do so run:
```sh
npx drizzle-kit push
```
Make sure to restart the backend server after pushing the changes, otherwise it gets very confused.

## Deployment

### Docker Deployment

The easiest way to deploy the server is using Docker:

```sh
# Copy and configure environment
cp .env.example .env
# Edit .env with your credentials and API keys

# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

The server will be available on port 3000 (configurable via `SERVER_PORT` in `.env`).

### Manual Deployment

```sh
# Install dependencies
npm install

# Build (if needed for any compiled assets)
npm run build

# Start the server
npm run server
```

## TODO
- Lost connection error for webpage (so that edits arent made then lost) (but still allow seeing the page)
- (maybe) Make the llm interface be provider agnostic
- (maybe) Switch to fully using groq-sdk
- Masonry layout
- more intuitive section focus opening method
- are you sure confirmation for big stuff like deleting section
- custom favicon
- pretty undo/redo buttons
- fix bulk-modification undo/redo broken-ness
- Add automatic database backups to guppy
- Add database rollback to backup UI to guppy
- Add persistent database files to guppy
- Implement section renaming in UI with double click or whatever
- hide completed todos (with toggle) on page load
- improve tab and auto-focus across page (e.g. the todo name input should be focused on opening the popup, but it isnt)
- undo/redo feedback (probably just grey out the buttons when there's nothing to undo/redo)
- fix `Uncaught (in promise) TRPCClientError: FOREIGN KEY constraint failed` error when redoing in certain circomstances
- dark reader prevention
- fix section popups not updating when section content changes (e.g. delete a todo in the section. open the popup. undo the delete. the popup does not show the newly recreated todo. close the popup, the new todo shows on the non-popup)

## DONE
- authentication
- Undo support
- Voice output (disabled, though)

## Goals
- Mobile app (at least android)
- Android widget for quick access
- Voice control to speak plain english commands to LLM to interface with todos

## Maybes
- Section symbols
- Automatic section coloring
- Priority level labels
- Optimistic client side state updates (remove a todo from the client side before waiting for the server to respond with the new state)
- Display todo sections with masonry layout