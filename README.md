## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
# Starting the backend server
npx drizzle-kit push
npm run start


# Starting the frontend page
npm run dev

# Optional (to open the page upon running): npm run dev -- --open
```

### Project Structure Oddities
While this is a svelte project, the server backend (running the database and llm api) is just node. This means that svelte features can only be used in the frontend side.

This means that we can use `import { env } from '$env/dynamic/private';` to get the environment vairables within the svelte related files, but we would have to use `import dotenv from 'dotenv'` (but preferably use `envProps.ts`) in order to get the environment variables.


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
- Make `Masonry.svlete` use tailwind
- Fix `Masonry.svelte` width problem
- Make the llm interface be provider agnostic
- Move the server files to within svelte

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