# Android Home Screen Widget Development Guide (Generated)

## Overview

For your Guppy todo app, you want an Android home screen widget that allows quick interaction with your LLM-powered todo list. Here's what you need to know:

## The Challenge with Tauri

**Tauri does NOT natively support Android widgets.** Tauri v2 provides basic Android app support, but widgets require native Android development.

## Recommended Approaches

### Option 1: Native Android Widget + Tauri App (Hybrid)

**Architecture:**
- Main app: Tauri (webview)
- Widget: Native Kotlin/Java code
- Communication: Via shared preferences or local server

**Pros:**
- Keep your existing web tech stack
- Best performance for widget
- Full widget customization

**Cons:**
- Need to learn Kotlin/Java for widget
- More complex build process
- Two separate codebases to maintain

**Implementation Steps:**
1. Keep Tauri for the main app
2. Add native Android code to `src-tauri/gen/android/`
3. Create widget in Kotlin using `AppWidgetProvider`
4. Widget communicates with your tRPC server via HTTP

### Option 2: React Native + Expo (Full Replacement)

**Architecture:**
- Replace Tauri with React Native
- Use Expo for easier development
- Use widget libraries like `react-native-android-widget`

**Pros:**
- Unified codebase (JavaScript/TypeScript)
- Excellent widget support via libraries
- Better mobile ecosystem
- Easier for Android-only development

**Cons:**
- Need to rewrite your Svelte UI to React
- Larger app size than Tauri
- Different build system to learn

**Key Libraries:**
- `react-native-android-widget` - Widget creation
- `react-native-home-widget` - Another widget option
- `@react-native-async-storage/async-storage` - Local storage

### Option 3: Flutter (Full Replacement)

**Architecture:**
- Replace everything with Flutter
- Native widget support via platform channels

**Pros:**
- Excellent performance
- Great widget support
- Single codebase for Android + iOS later
- Compiled to native code

**Cons:**
- Complete rewrite in Dart
- Steeper learning curve if unfamiliar
- Larger initial investment

## Recommended Solution for You

Given your goals and current stack, I recommend:

### **Short Term: Tauri App + Native Android Widget**

This lets you keep your existing web app while adding the widget functionality.

#### Widget Implementation Guide

1. **Create Widget Class** (`src-tauri/gen/android/app/src/main/java/com/tauri/dev/GuppyWidget.kt`):

```kotlin
package com.tauri.dev

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.app.PendingIntent
import kotlinx.coroutines.*
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

class GuppyWidget : AppWidgetProvider() {
    
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }
    
    private fun updateAppWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        // Create RemoteViews
        val views = RemoteViews(context.packageName, R.layout.widget_layout)
        
        // Set up voice input button
        val voiceIntent = Intent(context, VoiceInputActivity::class.java)
        val voicePendingIntent = PendingIntent.getActivity(
            context, 0, voiceIntent, PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.voice_button, voicePendingIntent)
        
        // Update widget
        appWidgetManager.updateAppWidget(appWidgetId, views)
    }
}
```

2. **Create Widget Layout** (`src-tauri/gen/android/app/src/main/res/layout/widget_layout.xml`):

```xml
<?xml version="1.0" encoding="utf-8"?>
<RelativeLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:padding="8dp"
    android:background="@drawable/widget_background">
    
    <TextView
        android:id="@+id/widget_title"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Guppy Tasks"
        android:textSize="16sp"
        android:textStyle="bold"
        android:layout_centerHorizontal="true"/>
    
    <Button
        android:id="@+id/voice_button"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_below="@id/widget_title"
        android:layout_marginTop="8dp"
        android:text="🎤 Voice Command"
        android:textSize="14sp"/>
    
    <TextView
        android:id="@+id/status_text"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_below="@id/voice_button"
        android:layout_marginTop="8dp"
        android:text="Ready"
        android:textSize="12sp"/>
</RelativeLayout>
```

3. **Register Widget in AndroidManifest.xml**:

```xml
<receiver android:name=".GuppyWidget"
    android:exported="true">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/widget_info" />
</receiver>
```

4. **Create Widget Info** (`src-tauri/gen/android/app/src/main/res/xml/widget_info.xml`):

```xml
<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="110dp"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/widget_layout"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:description="@string/widget_description">
</appwidget-provider>
```

5. **Voice Input Activity** - Handles speech recognition and sends to LLM:

```kotlin
class VoiceInputActivity : AppCompatActivity() {
    private val SPEECH_REQUEST_CODE = 0
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        startVoiceRecognition()
    }
    
    private fun startVoiceRecognition() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, 
                     RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_PROMPT, "Tell me what to do...")
        }
        startActivityForResult(intent, SPEECH_REQUEST_CODE)
    }
    
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        
        if (requestCode == SPEECH_REQUEST_CODE && resultCode == RESULT_OK) {
            val results = data?.getStringArrayListExtra(
                RecognizerIntent.EXTRA_RESULTS
            )
            val spokenText = results?.get(0) ?: ""
            
            // Send to your tRPC server
            sendToLLM(spokenText)
        }
        finish()
    }
    
    private fun sendToLLM(text: String) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val serverUrl = getServerUrl() // From SharedPreferences
                val url = URL("$serverUrl/llmMessage?input=$text")
                val connection = url.openConnection() as HttpURLConnection
                // Add session ID, make request, handle response
                // ...
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
```

### Long Term: Consider React Native

If you plan to expand mobile features significantly, React Native might be worth the rewrite:

```bash
# Initialize React Native project with Expo
npx create-expo-app guppy-mobile
cd guppy-mobile

# Install widget library
npm install react-native-android-widget

# Install tRPC client
npm install @trpc/client @trpc/server

# Your existing tRPC setup works the same!
```

## Voice Integration

For voice commands, both approaches use Android's built-in speech recognition:

```kotlin
// No external API needed!
Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
```

This is free and works offline (for recognition, not LLM processing).

## Summary

**Answer to your questions:**

1. ✅ **Tauri works** for the main Android app
2. ❌ **Tauri does NOT work** for widgets - need native code
3. 🔧 **For widgets specifically**: Native Android (Kotlin) OR consider React Native/Flutter

**My recommendation:**
- Start with Tauri + Native Android widget (hybrid approach)
- If you need more mobile features later, consider migrating to React Native
- Keep your tRPC backend - it works perfectly with any client!

The server separation work we just did is exactly what you need - now your mobile app can connect to a central server while the widget makes quick API calls for voice commands.
