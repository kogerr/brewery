# Android Home Screen Widget — RPi-Pill Fermentation Monitor

## 1. Feasibility Assessment

### Can we render a dual-axis time-series graph in an Android App Widget?

**Yes, with a bitmap-rendering approach.** Android App Widgets use `RemoteViews`, which only support a limited set of views (`TextView`, `ImageView`, `Button`, `LinearLayout`, `FrameLayout`, etc.). Custom `View` subclasses and Canvas-based views are **not** directly supported in `RemoteViews`.

However, the standard workaround is well-established:

1. Render the chart off-screen using Android's `Canvas` API onto a `Bitmap`
2. Set the resulting `Bitmap` on an `ImageView` inside the widget layout via `RemoteViews.setImageViewBitmap()`

This is a widely-used pattern for widgets that display charts, graphs, or any custom-drawn content. Performance is fine because we're rendering a single static image (not animating).

### Key Constraints

| Constraint | Impact | Mitigation |
|---|---|---|
| RemoteViews only supports system Views | No custom View classes in layout | Render to Bitmap, display in ImageView |
| Widget memory limit (~2-5 MB for bitmaps) | Large bitmaps can crash | Keep bitmap dimensions reasonable (match widget size) |
| No direct user interaction with chart | Can't zoom/pan the graph | Tap widget to open a full Activity with interactive chart |
| Update frequency minimum ~15 min (AlarmManager) | Can't update every second | Use WorkManager with 15-30 min interval; acceptable for fermentation |
| Local network only | Widget won't work on mobile data | Show "last updated" timestamp + graceful offline state |

### Verdict

Fully feasible. The bitmap rendering approach is standard practice and will produce a clean dual-axis chart. The 15-30 minute update interval is more than adequate for fermentation monitoring where gravity changes over hours/days.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  Android App                      │
│                                                   │
│  ┌──────────────┐    ┌────────────────────────┐  │
│  │ Widget Layout │    │ ConfigurationActivity  │  │
│  │ (RemoteViews) │    │ - Set hostname/IP      │  │
│  │  ┌──────────┐│    │ - Set update interval   │  │
│  │  │ ImageView ││    └────────────────────────┘  │
│  │  │ (chart)   ││                                │
│  │  └──────────┘│    ┌────────────────────────┐  │
│  │  ┌──────────┐│    │ PillWidgetProvider      │  │
│  │  │ TextView  ││◄───│ (AppWidgetProvider)     │  │
│  │  │ (gravity) ││    │ - onUpdate()            │  │
│  │  └──────────┘│    │ - onReceive()           │  │
│  │  ┌──────────┐│    └───────────┬────────────┘  │
│  │  │ TextView  ││               │                │
│  │  │ (updated) ││    ┌──────────▼────────────┐  │
│  │  └──────────┘│    │ DataFetchWorker         │  │
│  └──────────────┘    │ (WorkManager)           │  │
│                       │ - Fetch from RPi API    │  │
│                       │ - Render chart bitmap   │  │
│                       │ - Update RemoteViews    │  │
│                       └───────────┬────────────┘  │
│                                   │                │
│                       ┌───────────▼────────────┐  │
│                       │ ChartRenderer          │  │
│                       │ - Canvas/Paint drawing  │  │
│                       │ - Dual Y-axes           │  │
│                       │ - Returns Bitmap        │  │
│                       └───────────┬────────────┘  │
│                                   │                │
│                       ┌───────────▼────────────┐  │
│                       │ ApiClient (OkHttp)     │  │
│                       │ - GET /api/readings     │  │
│                       │ - GET /api/readings/    │  │
│                       │   latest                │  │
│                       └────────────────────────┘  │
└─────────────────────────────────────────────────┘
                          │
                          ▼
              ┌──────────────────────┐
              │  RPi (rpi3:3000)     │
              │  /api/readings       │
              │  /api/readings/latest│
              └──────────────────────┘
```

### Components

| Component | Responsibility |
|---|---|
| `PillWidgetProvider` | `AppWidgetProvider` subclass; handles widget lifecycle events; triggers data fetch on update |
| `DataFetchWorker` | `CoroutineWorker` (WorkManager); runs in background; fetches API data, renders chart, updates widget |
| `ChartRenderer` | Pure Kotlin class; takes readings data, outputs a `Bitmap` with the dual-axis chart |
| `ApiClient` | OkHttp-based HTTP client; fetches readings from the RPi |
| `ConfigurationActivity` | Launched when widget is first placed; user enters the RPi hostname/IP |
| `PrefsRepository` | Thin wrapper around `SharedPreferences` for storing hostname and widget config |

---

## 3. Graph Rendering Strategy

### Approach: Manual Canvas Drawing

For a widget, manual `Canvas` drawing is **better than using a charting library** because:

- **MPAndroidChart** and similar libraries are designed for interactive `View`-based charts, not off-screen bitmap rendering. While it's technically possible to render MPAndroidChart to a bitmap, it's over-engineered for this use case and adds a large dependency.
- The chart is simple (two line series, dual axes, time axis) — roughly 200 lines of drawing code.
- Full control over appearance, colors, and sizing for small widget displays.

### Chart Design

```
   SG                                        °C
 1.060 ┤                                    ├ 24
       │  ╭──╮                               │
 1.050 ┤  │   ╲                          ╭──├ 22
       │ ╱     ╲        ·····temp·····╱   │
 1.040 ┤╱       ╲      ╱·            ╱    ├ 20
       │          ╲    ╱  ·                 │
 1.030 ┤           ╲──╱    ·····          ├ 18
       │            gravity      ···       │
 1.020 ┤                           ···    ├ 16
       │                              ··   │
 1.010 ┤──────────────────────────────────├ 14
       └──┬────┬────┬────┬────┬────┬────┘
        Mar12 Mar13 Mar14 Mar15 Mar16 Mar17
```

- **Left Y-axis**: Specific Gravity (e.g., 1.010–1.060)
- **Right Y-axis**: Temperature in °C
- **X-axis**: Date/time labels
- **Gravity line**: Bold, primary color (amber/orange)
- **Temperature line**: Thinner, secondary color (blue), optionally dashed
- **Background**: Dark (works well on home screens)
- **Grid lines**: Subtle, low-contrast

### Canvas Rendering Code Sketch

```kotlin
class ChartRenderer {

    data class Reading(
        val specificGravity: Double,
        val temperatureC: Double,
        val timestamp: Long  // epoch millis
    )

    fun render(
        readings: List<Reading>,
        widthPx: Int,
        heightPx: Int
    ): Bitmap {
        val bitmap = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        // Define chart area with margins for axes
        val marginLeft = 80f    // space for SG labels
        val marginRight = 70f   // space for temp labels
        val marginTop = 20f
        val marginBottom = 50f  // space for time labels

        val chartLeft = marginLeft
        val chartRight = widthPx - marginRight
        val chartTop = marginTop
        val chartBottom = heightPx - marginBottom

        // Background
        canvas.drawColor(Color.parseColor("#1a1a2e"))

        // Calculate data ranges
        val sgMin = readings.minOf { it.specificGravity } - 0.002
        val sgMax = readings.maxOf { it.specificGravity } + 0.002
        val tempMin = readings.minOf { it.temperatureC } - 1.0
        val tempMax = readings.maxOf { it.temperatureC } + 1.0
        val timeMin = readings.minOf { it.timestamp }
        val timeMax = readings.maxOf { it.timestamp }

        // Helper: map data value to pixel coordinate
        fun mapX(time: Long): Float =
            chartLeft + (time - timeMin).toFloat() / (timeMax - timeMin) * (chartRight - chartLeft)

        fun mapYGravity(sg: Double): Float =
            chartBottom - ((sg - sgMin) / (sgMax - sgMin) * (chartBottom - chartTop)).toFloat()

        fun mapYTemp(temp: Double): Float =
            chartBottom - ((temp - tempMin) / (tempMax - tempMin) * (chartBottom - chartTop)).toFloat()

        // Draw grid lines
        val gridPaint = Paint().apply {
            color = Color.parseColor("#333355")
            strokeWidth = 1f
            style = Paint.Style.STROKE
        }
        // ... draw horizontal grid lines for SG ticks ...

        // Draw gravity line
        val gravityPaint = Paint().apply {
            color = Color.parseColor("#f59e0b")  // amber
            strokeWidth = 4f
            style = Paint.Style.STROKE
            isAntiAlias = true
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
        }
        val gravityPath = Path()
        readings.forEachIndexed { i, r ->
            val x = mapX(r.timestamp)
            val y = mapYGravity(r.specificGravity)
            if (i == 0) gravityPath.moveTo(x, y) else gravityPath.lineTo(x, y)
        }
        canvas.drawPath(gravityPath, gravityPaint)

        // Draw temperature line
        val tempPaint = Paint().apply {
            color = Color.parseColor("#3b82f6")  // blue
            strokeWidth = 2.5f
            style = Paint.Style.STROKE
            isAntiAlias = true
            pathEffect = DashPathEffect(floatArrayOf(8f, 4f), 0f)  // dashed
        }
        val tempPath = Path()
        readings.forEachIndexed { i, r ->
            val x = mapX(r.timestamp)
            val y = mapYTemp(r.temperatureC)
            if (i == 0) tempPath.moveTo(x, y) else tempPath.lineTo(x, y)
        }
        canvas.drawPath(tempPath, tempPaint)

        // Draw axis labels (SG on left, Temp on right, dates on bottom)
        val labelPaint = Paint().apply {
            color = Color.parseColor("#aaaacc")
            textSize = 22f
            isAntiAlias = true
        }
        // ... draw tick labels for SG, temp, and date ...

        return bitmap
    }
}
```

### Handling Different Widget Sizes

Android provides widget size info via `AppWidgetManager.getAppWidgetOptions()`. The renderer should accept pixel dimensions and scale accordingly. For resizable widgets, handle `onAppWidgetOptionsChanged()` to re-render.

```kotlin
// In PillWidgetProvider
override fun onAppWidgetOptionsChanged(
    context: Context, appWidgetManager: AppWidgetManager,
    appWidgetId: Int, newOptions: Bundle
) {
    // Trigger a re-render with new dimensions
    enqueueUpdate(context, appWidgetId)
}
```

To convert dp from the options bundle to pixels:

```kotlin
fun getWidgetSizePx(context: Context, options: Bundle): Pair<Int, Int> {
    val density = context.resources.displayMetrics.density
    val widthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)
    val heightDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT)
    return Pair((widthDp * density).toInt(), (heightDp * density).toInt())
}
```

---

## 4. Data Fetching Strategy

### OkHttp for Network Calls

OkHttp is the best choice here — lightweight, well-supported, and doesn't need the overhead of Retrofit for two simple GET endpoints.

```kotlin
class ApiClient(private val baseUrl: String) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    private val json = Json { ignoreUnknownKeys = true }

    @Serializable
    data class Reading(
        val specificGravity: Double,
        val temperatureC: Double,
        val timestamp: String
    )

    suspend fun getReadings(limit: Int = 500): List<Reading> = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("$baseUrl/api/readings?limit=$limit")
            .build()
        val response = client.newCall(request).execute()
        val body = response.body?.string() ?: throw IOException("Empty response")
        json.decodeFromString<List<Reading>>(body)
    }

    suspend fun getLatestReading(): Reading? = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("$baseUrl/api/readings/latest")
            .build()
        val response = client.newCall(request).execute()
        val body = response.body?.string() ?: return@withContext null
        if (body == "null") return@withContext null
        json.decodeFromString<Reading>(body)
    }
}
```

### Update Scheduling: WorkManager

**WorkManager** is the recommended approach over `AlarmManager` because:

- Survives app restarts and device reboots
- Respects battery optimization / Doze mode
- Can set network constraints (require WiFi)
- Minimum interval is 15 minutes, which is perfect for fermentation monitoring

```kotlin
class DataFetchWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val prefs = PrefsRepository(applicationContext)
        val baseUrl = prefs.getBaseUrl() ?: return Result.failure()

        return try {
            val client = ApiClient(baseUrl)
            val readings = client.getReadings(limit = 500)
            val latest = readings.lastOrNull()

            // Get all widget IDs
            val appWidgetManager = AppWidgetManager.getInstance(applicationContext)
            val widgetIds = appWidgetManager.getAppWidgetIds(
                ComponentName(applicationContext, PillWidgetProvider::class.java)
            )

            for (widgetId in widgetIds) {
                val options = appWidgetManager.getAppWidgetOptions(widgetId)
                val (width, height) = getWidgetSizePx(applicationContext, options)

                // Render chart
                val chartBitmap = ChartRenderer().render(
                    readings = readings.map { /* convert to renderer model */ },
                    widthPx = width.coerceAtLeast(400),
                    heightPx = height.coerceAtLeast(200)
                )

                // Build RemoteViews
                val views = RemoteViews(
                    applicationContext.packageName,
                    R.layout.widget_pill
                )
                views.setImageViewBitmap(R.id.chart_image, chartBitmap)
                views.setTextViewText(
                    R.id.gravity_text,
                    latest?.let { "%.4f".format(it.specificGravity) } ?: "—"
                )
                views.setTextViewText(
                    R.id.updated_text,
                    "Updated ${formatTime(System.currentTimeMillis())}"
                )

                // Set click intent to open config/detail activity
                val intent = Intent(applicationContext, DetailActivity::class.java)
                val pendingIntent = PendingIntent.getActivity(
                    applicationContext, widgetId, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

                appWidgetManager.updateAppWidget(widgetId, views)
            }

            Result.success()
        } catch (e: Exception) {
            // Update widget to show error state
            Result.retry()  // WorkManager will retry with backoff
        }
    }
}
```

### Scheduling the Worker

```kotlin
fun schedulePeriodicUpdate(context: Context) {
    val constraints = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()

    val workRequest = PeriodicWorkRequestBuilder<DataFetchWorker>(
        30, TimeUnit.MINUTES  // runs every ~30 min
    )
        .setConstraints(constraints)
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 5, TimeUnit.MINUTES)
        .build()

    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        "pill_widget_update",
        ExistingPeriodicWorkPolicy.KEEP,
        workRequest
    )
}
```

### Local Network Considerations

- The RPi is only accessible on local WiFi — the widget will only update when connected to the home network.
- The `NetworkType.CONNECTED` constraint ensures we don't try when offline.
- Consider adding a `NetworkType.UNMETERED` constraint to only fetch on WiFi (not mobile data), though this would prevent updates on hotspots.
- **mDNS/hostname resolution**: `rpi3` may not resolve on Android. The configuration activity should let the user enter an IP address (e.g., `192.168.1.XX`) or a `.local` hostname. Android supports mDNS via `NsdManager` but it's unreliable — recommending IP address is simpler.
- When the Pi is unreachable, the Worker returns `Result.retry()` and WorkManager applies exponential backoff. The widget shows the last successful data with a stale timestamp, making it obvious the data isn't fresh.

---

## 5. Detailed Implementation Plan

### 5.1 Project Structure

```
app/
├── src/main/
│   ├── java/com/brewery/pillwidget/
│   │   ├── ApiClient.kt              # OkHttp API client
│   │   ├── ChartRenderer.kt          # Canvas bitmap rendering
│   │   ├── ConfigActivity.kt         # Widget configuration activity
│   │   ├── DataFetchWorker.kt        # WorkManager background worker
│   │   ├── DetailActivity.kt         # Full-screen view (tap widget)
│   │   ├── PillWidgetProvider.kt     # AppWidgetProvider
│   │   ├── PrefsRepository.kt        # SharedPreferences helper
│   │   └── Reading.kt                # Data model
│   ├── res/
│   │   ├── layout/
│   │   │   ├── widget_pill.xml        # Widget RemoteViews layout
│   │   │   ├── activity_config.xml    # Configuration screen
│   │   │   └── activity_detail.xml    # Detail screen (optional)
│   │   ├── xml/
│   │   │   └── pill_widget_info.xml   # Widget metadata
│   │   ├── drawable/
│   │   │   └── widget_background.xml  # Rounded rect background
│   │   └── values/
│   │       ├── strings.xml
│   │       └── colors.xml
│   └── AndroidManifest.xml
├── build.gradle.kts
└── gradle/
```

### 5.2 Widget Metadata — `res/xml/pill_widget_info.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="180dp"
    android:targetCellWidth="4"
    android:targetCellHeight="3"
    android:minResizeWidth="180dp"
    android:minResizeHeight="110dp"
    android:resizeMode="horizontal|vertical"
    android:updatePeriodMillis="1800000"
    android:configure="com.brewery.pillwidget.ConfigActivity"
    android:initialLayout="@layout/widget_pill"
    android:widgetCategory="home_screen"
    android:previewLayout="@layout/widget_pill"
    android:description="@string/widget_description" />
```

Key settings:
- `updatePeriodMillis="1800000"` — 30 minutes (system minimum is ~30 min for this attribute; we also use WorkManager)
- `configure` — points to the configuration activity (runs when widget is first added)
- `resizeMode` — allows the user to resize in both directions
- `targetCellWidth/Height` — default 4x3 cells on the home screen

### 5.3 Widget Layout — `res/layout/widget_pill.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:background="@drawable/widget_background"
    android:padding="8dp">

    <!-- Header row: title + last gravity reading -->
    <RelativeLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:paddingBottom="4dp">

        <TextView
            android:id="@+id/title_text"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_alignParentStart="true"
            android:text="Fermentation"
            android:textColor="#aaaacc"
            android:textSize="12sp" />

        <TextView
            android:id="@+id/gravity_text"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_alignParentEnd="true"
            android:text="1.0452"
            android:textColor="#f59e0b"
            android:textSize="20sp"
            android:textStyle="bold"
            android:fontFamily="monospace" />
    </RelativeLayout>

    <!-- Chart area -->
    <ImageView
        android:id="@+id/chart_image"
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"
        android:scaleType="fitXY"
        android:contentDescription="Fermentation chart" />

    <!-- Footer: last updated timestamp -->
    <TextView
        android:id="@+id/updated_text"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Updated 15:30"
        android:textColor="#666688"
        android:textSize="10sp"
        android:gravity="end"
        android:paddingTop="2dp" />

</LinearLayout>
```

### 5.4 Widget Background Drawable — `res/drawable/widget_background.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="#E61a1a2e" />
    <corners android:radius="16dp" />
</shape>
```

### 5.5 `AppWidgetProvider` — `PillWidgetProvider.kt`

```kotlin
package com.brewery.pillwidget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import androidx.work.*
import java.util.concurrent.TimeUnit

class PillWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        // Trigger an immediate one-time fetch
        enqueueOneTimeUpdate(context)
    }

    override fun onEnabled(context: Context) {
        // First widget placed — start periodic updates
        schedulePeriodicUpdate(context)
    }

    override fun onDisabled(context: Context) {
        // Last widget removed — cancel periodic updates
        WorkManager.getInstance(context)
            .cancelUniqueWork("pill_widget_periodic")
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: android.os.Bundle
    ) {
        // Widget resized — re-render
        enqueueOneTimeUpdate(context)
    }

    companion object {
        fun enqueueOneTimeUpdate(context: Context) {
            val request = OneTimeWorkRequestBuilder<DataFetchWorker>()
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .build()
            WorkManager.getInstance(context).enqueue(request)
        }

        fun schedulePeriodicUpdate(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<DataFetchWorker>(
                30, TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL, 5, TimeUnit.MINUTES
                )
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "pill_widget_periodic",
                ExistingPeriodicWorkPolicy.UPDATE,
                request
            )
        }
    }
}
```

### 5.6 Configuration Activity — `ConfigActivity.kt`

This activity launches when the user first adds the widget to their home screen.

```kotlin
package com.brewery.pillwidget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText

class ConfigActivity : Activity() {

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_config)

        // Default result = cancelled (if user backs out)
        setResult(RESULT_CANCELED)

        // Get widget ID from intent
        appWidgetId = intent?.extras?.getInt(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID

        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }

        val hostInput = findViewById<EditText>(R.id.host_input)
        val saveButton = findViewById<Button>(R.id.save_button)

        // Pre-fill with saved value
        val prefs = PrefsRepository(this)
        hostInput.setText(prefs.getBaseUrl() ?: "http://192.168.1.")

        saveButton.setOnClickListener {
            val url = hostInput.text.toString().trimEnd('/')
            prefs.setBaseUrl(url)

            // Trigger initial data fetch
            PillWidgetProvider.enqueueOneTimeUpdate(this)

            // Return success
            val result = Intent().putExtra(
                AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId
            )
            setResult(RESULT_OK, result)
            finish()
        }
    }
}
```

### 5.7 Data Model — `Reading.kt`

```kotlin
package com.brewery.pillwidget

import kotlinx.serialization.Serializable

@Serializable
data class ReadingDto(
    val specificGravity: Double,
    val temperatureC: Double,
    val timestamp: String  // ISO 8601
)

data class Reading(
    val specificGravity: Double,
    val temperatureC: Double,
    val timestamp: Long  // epoch millis
)

fun ReadingDto.toReading(): Reading {
    val instant = java.time.Instant.parse(timestamp)
    return Reading(
        specificGravity = specificGravity,
        temperatureC = temperatureC,
        timestamp = instant.toEpochMilli()
    )
}
```

### 5.8 Preferences — `PrefsRepository.kt`

```kotlin
package com.brewery.pillwidget

import android.content.Context

class PrefsRepository(context: Context) {
    private val prefs = context.getSharedPreferences("pill_widget", Context.MODE_PRIVATE)

    fun getBaseUrl(): String? = prefs.getString("base_url", null)

    fun setBaseUrl(url: String) {
        prefs.edit().putString("base_url", url).apply()
    }
}
```

### 5.9 AndroidManifest.xml Additions

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.brewery.pillwidget">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:allowBackup="true"
        android:label="@string/app_name"
        android:theme="@style/Theme.Material3.DayNight">

        <!-- Widget provider -->
        <receiver
            android:name=".PillWidgetProvider"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/pill_widget_info" />
        </receiver>

        <!-- Configuration activity -->
        <activity
            android:name=".ConfigActivity"
            android:exported="true"
            android:theme="@style/Theme.Material3.DayNight.Dialog">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_CONFIGURE" />
            </intent-filter>
        </activity>

        <!-- Detail activity (tap to open) -->
        <activity
            android:name=".DetailActivity"
            android:exported="false" />

    </application>
</manifest>
```

### 5.10 Gradle Configuration — `app/build.gradle.kts`

```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "com.brewery.pillwidget"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.brewery.pillwidget"
        minSdk = 26        // Android 8.0 — covers 95%+ of devices
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // Kotlin
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    // Network
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // WorkManager
    implementation("androidx.work:work-runtime-ktx:2.10.0")

    // AndroidX
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
}
```

### Root `build.gradle.kts`

```kotlin
plugins {
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.1.0" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.1.0" apply false
}
```

---

## 6. Development Environment

### IDE: Android Studio (Strongly Recommended)

While IntelliJ IDEA Ultimate includes Android plugin support, **Android Studio** is the better choice for this project:

| Feature | Android Studio | IntelliJ IDEA |
|---|---|---|
| Android SDK management | Built-in, automatic | Manual setup required |
| Widget preview | Layout preview works out of box | Possible but less reliable |
| Emulator management | AVD Manager integrated | Requires separate setup |
| Widget debugging | "Attach to process" workflow tuned for widgets | Same, but less convenient |
| Gradle sync for Android | Optimized | Works but slower |
| Cost | Free | Ultimate required ($) |

**Android Studio is free and purpose-built for this.** Download from [developer.android.com/studio](https://developer.android.com/studio).

### Setup Steps

1. **Install Android Studio** (latest stable, currently Ladybug or later)

2. **Android SDK** — Android Studio will prompt to install these on first run:
   - SDK Platform: Android 15 (API 35)
   - Build Tools: 35.0.0
   - Android SDK Platform-Tools (for `adb`)
   - Android SDK Command-line Tools

3. **Create New Project**:
   - Template: "Empty Activity" (or "No Activity" — we'll mostly use widget components)
   - Language: Kotlin
   - Minimum SDK: API 26 (Android 8.0)
   - Build system: Gradle (Kotlin DSL)

4. **Add dependencies** as listed in the Gradle section above

5. **Test device options**:

   **Emulator** — Adequate for initial development:
   - Create an AVD (Android Virtual Device) in AVD Manager
   - Use a Pixel 7 or similar image with API 35
   - Widget testing: Long-press home → Widgets → find "Pill Widget" → place it
   - Caveat: The emulator can't reach `rpi3` on your LAN by default. Options:
     - Use `adb reverse tcp:3000 tcp:3000` if RPi is port-forwarded
     - Run a mock server on your dev machine, use `10.0.2.2:3000` (emulator's host alias)
     - Simplest: create a mock/test mode that uses hardcoded sample data

   **Physical device** — Better for final testing:
   - Enable Developer Options + USB Debugging on your Android phone
   - Connect via USB, `adb devices` should list it
   - Run/debug directly from Android Studio
   - Physical device **on the same WiFi** can reach `rpi3:3000` directly
   - Widget sizing and rendering will be accurate

   **Recommendation**: Start with emulator + mock data, then test on physical device for real network + widget appearance.

6. **Additional tools**:
   - `adb` (included with Platform-Tools) — for debugging, log viewing
   - `adb shell appwidget` commands for widget debugging:
     ```bash
     # Force widget update
     adb shell am broadcast -a android.appwidget.action.APPWIDGET_UPDATE \
       --ei appWidgetId <id> -n com.brewery.pillwidget/.PillWidgetProvider
     ```

---

## 7. Step-by-Step Build Order

This is the recommended implementation sequence:

### Phase 1: Skeleton (1-2 hours)
1. Create project in Android Studio with the Gradle config above
2. Add `pill_widget_info.xml`, `widget_pill.xml`, and `widget_background.xml`
3. Create `PillWidgetProvider` (bare minimum — just set static text on the RemoteViews)
4. Register in `AndroidManifest.xml`
5. **Verify**: Deploy to emulator, place widget on home screen, see static text

### Phase 2: Chart Rendering (2-3 hours)
1. Create `Reading.kt` data model
2. Implement `ChartRenderer` with hardcoded sample data
3. In `PillWidgetProvider.onUpdate()`, call `ChartRenderer` with sample data and set the bitmap
4. **Verify**: Widget displays a chart with sample fermentation data

### Phase 3: Network Layer (1-2 hours)
1. Implement `ApiClient` with OkHttp
2. Implement `PrefsRepository`
3. Create `ConfigActivity` — text field for URL, save button
4. **Verify**: Config activity saves URL; manually call API client from a test to confirm JSON parsing

### Phase 4: Background Updates (1-2 hours)
1. Implement `DataFetchWorker` — ties together ApiClient, ChartRenderer, and RemoteViews update
2. Wire up WorkManager scheduling in `PillWidgetProvider.onEnabled()`
3. Wire up one-time fetch in `onUpdate()` and `ConfigActivity`
4. **Verify**: Widget auto-updates with real data from the RPi (test on physical device on same WiFi)

### Phase 5: Polish (1-2 hours)
1. Handle error states (no network, RPi unreachable) — show "No data" or stale timestamp
2. Implement tap-to-open `DetailActivity` (optional — could open a full-screen interactive chart)
3. Fine-tune chart appearance: colors, label formatting, line smoothing
4. Test widget at different sizes
5. Test with real fermentation data over time

---

## 8. Summary

| Decision | Choice | Reason |
|---|---|---|
| Graph rendering | Manual Canvas → Bitmap | Full control, no heavy library, standard widget pattern |
| Network client | OkHttp + kotlinx.serialization | Lightweight, 2 endpoints don't need Retrofit |
| Background updates | WorkManager (30 min periodic) | Battery-friendly, survives reboots, network constraints |
| IDE | Android Studio | Free, purpose-built, integrated SDK/emulator management |
| Min SDK | API 26 (Android 8.0) | Modern APIs (java.time, etc.), covers 95%+ devices |
| Configuration | Activity on widget add | User enters RPi IP address |
| Chart library | None (manual drawing) | Simpler, smaller APK, better control for widget bitmap |
