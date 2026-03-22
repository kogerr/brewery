package com.brewery.pillwidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.RemoteViews
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class DataFetchWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val prefs = PrefsRepository(applicationContext)
        val baseUrl = prefs.getBaseUrl() ?: run {
            Log.e(TAG, "No base URL configured")
            return Result.failure()
        }
        val fallbackUrl = prefs.getFallbackUrl()
        val pillName = prefs.getPillName()
        Log.d(TAG, "Fetching from: $baseUrl (fallback: $fallbackUrl, pill: $pillName)")

        return try {
            val client = ApiClient(baseUrl, fallbackUrl)
            val readingDtos = client.getReadings(limit = 500, pill = pillName)
            Log.d(TAG, "Got ${readingDtos.size} readings")
            val readings = readingDtos.map { it.toReading() }
            val latest = readings.lastOrNull()

            val appWidgetManager = AppWidgetManager.getInstance(applicationContext)
            val widgetIds = appWidgetManager.getAppWidgetIds(
                ComponentName(applicationContext, PillWidgetProvider::class.java)
            )

            for (widgetId in widgetIds) {
                val options = appWidgetManager.getAppWidgetOptions(widgetId)
                val (width, height) = getWidgetSizePx(applicationContext, options)

                val chartBitmap = ChartRenderer().render(
                    readings = readings,
                    widthPx = width.coerceAtLeast(400),
                    heightPx = height.coerceAtLeast(200)
                )

                val views = RemoteViews(
                    applicationContext.packageName,
                    R.layout.widget_pill
                )
                views.setImageViewBitmap(R.id.chart_image, chartBitmap)
                views.setTextViewText(
                    R.id.gravity_text,
                    latest?.let { "%.4f".format(it.specificGravity) } ?: "\u2014"
                )
                views.setTextViewText(
                    R.id.updated_text,
                    "Updated ${formatTime(System.currentTimeMillis())}"
                )

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
            Log.e(TAG, "Fetch failed: ${e.javaClass.simpleName}: ${e.message}", e)
            Result.retry()
        }
    }

    companion object {
        private const val TAG = "PillWidget"
        fun getWidgetSizePx(context: Context, options: Bundle): Pair<Int, Int> {
            val density = context.resources.displayMetrics.density
            val widthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250)
            val heightDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 180)
            return Pair((widthDp * density).toInt(), (heightDp * density).toInt())
        }

        fun formatTime(millis: Long): String {
            val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())
            return sdf.format(Date(millis))
        }
    }
}
