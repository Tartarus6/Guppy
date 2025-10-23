## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
# Starting the server
npm run dev

# Optional (to open the page upon running): npm run dev -- --open
```

### Database Management
If changes are made to the schema, the `.db` file will need to be updated.
To do so run:
```sh
npx drizzle-kit push
```
Make sure to restart the backend server after pushing the changes, otherwise it gets very confused.

## TODO
- Create deployment instructions
- Docker deployable
- Lost connection error for webpage (so that edits arent made then lost) (but still allow seeing the page)
- Undo support
- (maybe) Make the llm interface be provider agnostic
- (maybe) Switch to fully using groq-sdk
- Masonry layout
- Voice output

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