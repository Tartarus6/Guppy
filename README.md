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

## Goals
- Mobile app (at least android)
- Android widget for quick access
- Voice control to speak plain english commands to LLM to interface with todos

## Maybes
- Section symbols
- Automatic section coloring
- Priority level labels