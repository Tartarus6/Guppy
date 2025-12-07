# Guppy Mobile Development - Summary & Answers

## Your Questions Answered

### 1. Will Tauri work for Android?

**Yes, with limitations:**
- ✅ Tauri v2 supports basic Android apps
- ✅ Your web-based UI will work in the Android app
- ❌ **Home screen widgets are NOT supported natively by Tauri**
- ⚠️ For widgets, you'll need native Android code (Kotlin/Java)

**Verdict:** Tauri works for the main app, but you'll need native code for widgets.

### 2. How to separate client and server?

**Completed! Here's what I implemented:**

#### Changes Made:

1. **`server.ts`** - Standalone server entry point
   - Run with: `npm run server`
   - No SvelteKit dependency

2. **Environment Configuration** (`.env`)
   - `SERVER_PORT` - Configure server port
   - `PUBLIC_SERVER_URL` - Client connects to this URL
   - Updated `src/lib/client/index.ts` to use env vars

3. **`hooks.server.ts`** - Conditional server start
   - Only starts server in development mode
   - In production, expects external server
   - Set `NODE_ENV=production` to disable auto-start

4. **Docker Support**
   - `Dockerfile` - Build server image
   - `docker-compose.yml` - Easy deployment
   - Persists database via volume mount

#### Architecture Now:

```
┌─────────────────┐         ┌──────────────┐
│  Mobile App     │────────▶│   Server     │
│  (Tauri/RN)     │  HTTP   │   (Node.js)  │
└─────────────────┘         │   + tRPC     │
                            │   + SQLite   │
┌─────────────────┐         │              │
│  Web App        │────────▶│              │
│  (SvelteKit)    │  HTTP   └──────────────┘
└─────────────────┘
```

#### How to Use:

**Development (local):**
```bash
npm run dev  # Runs SvelteKit + integrated server
```

**Mobile/Production (separate server):**
```bash
# On server machine:
docker-compose up -d
# OR: npm run server

# On mobile app:
# Set in .env:
PUBLIC_SERVER_URL=http://your-server-ip:3000
```

### 3. How to make a home screen widget?

**See `MOBILE_DEVELOPMENT.md` for full details.**

**Short answer:**
Widgets require native Android development. You have 3 options:

#### Option A: Hybrid (Tauri + Native Widget) ⭐ Recommended to Start

**Pros:**
- Keep your existing code
- Full widget control
- Best of both worlds

**Cons:**
- Learn Kotlin for widget only
- Two separate codebases

**Structure:**
```
src-tauri/
  └── gen/android/
      └── app/src/main/java/
          └── GuppyWidget.kt     ← Native widget code
          └── VoiceInputActivity.kt  ← Voice capture

src/
  └── (your existing Svelte code)
```

Widget communicates with your tRPC server via HTTP for LLM commands.

#### Option B: React Native + Expo

**Pros:**
- Unified JavaScript/TypeScript codebase
- Great widget libraries (`react-native-android-widget`)
- Better mobile ecosystem

**Cons:**
- Rewrite UI from Svelte to React
- Larger app size

**Good if:** You plan extensive mobile features beyond just the widget.

#### Option C: Flutter

**Pros:**
- Best performance
- Great widget support
- Single codebase for Android + future iOS

**Cons:**
- Learn Dart
- Complete rewrite

**Good if:** You want long-term native mobile development.

## Widget Technical Details

For the **voice-command widget** you described:

1. **Widget Layout** - Shows quick-access button
2. **Voice Input** - Uses Android's built-in `RecognizerIntent` (free, no API)
3. **LLM Processing** - Sends transcribed text to your tRPC server
4. **Response** - Updates widget or opens app to show results

**Example widget flow:**
```
User taps widget button
    ↓
Android voice recognition
    ↓
"Add milk to shopping list"
    ↓
POST to your server: /llmMessage
    ↓
LLM processes command
    ↓
Server creates todo item
    ↓
Widget shows "✓ Added"
```

## Recommended Path Forward

1. **Phase 1: Test Server Separation** (Now)
   ```bash
   npm install        # Install new dependencies (tsx)
   npm run server     # Test standalone server
   ```

2. **Phase 2: Build Android App** (Next)
   - Use Tauri to build basic Android app
   - Test connecting to remote server
   ```bash
   npm run tauri android dev
   ```

3. **Phase 3: Add Widget** (Later)
   - Choose between:
     - **Quick win:** Native Kotlin widget (see `MOBILE_DEVELOPMENT.md`)
     - **Future-proof:** Migrate to React Native if you need more mobile features

4. **Phase 4: Deploy Server**
   ```bash
   docker-compose up -d
   ```

## Files Created/Modified

### New Files:
- ✨ `server.ts` - Standalone server
- ✨ `Dockerfile` - Server containerization  
- ✨ `docker-compose.yml` - Easy deployment
- ✨ `.dockerignore` - Optimize builds
- ✨ `setup.sh` - Quick setup script
- ✨ `MOBILE_DEVELOPMENT.md` - Detailed Android guide
- ✨ `SUMMARY.md` - This file

### Modified Files:
- 📝 `package.json` - Added `server` script, `tsx` dependency
- 📝 `.env.example` - Added `SERVER_PORT`, `PUBLIC_SERVER_URL`
- 📝 `src/lib/client/index.ts` - Use env-based server URL
- 📝 `src/lib/server/index.ts` - Use env-based port
- 📝 `src/hooks.server.ts` - Conditional server start
- 📝 `README.md` - Deployment instructions

## Next Steps

1. **Install new dependencies:**
   ```bash
   npm install
   ```

2. **Create your `.env` file:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Test standalone server:**
   ```bash
   npm run server
   ```

4. **Test client connection:**
   - In another terminal: `npm run dev`
   - Should connect to server on port 3000

5. **Read the mobile guide:**
   - Open `MOBILE_DEVELOPMENT.md`
   - Review widget implementation examples
   - Decide on Hybrid vs React Native approach

## Questions?

Feel free to ask about:
- Widget implementation specifics
- React Native migration considerations
- Server deployment best practices
- Tauri Android configuration
- Voice integration details
