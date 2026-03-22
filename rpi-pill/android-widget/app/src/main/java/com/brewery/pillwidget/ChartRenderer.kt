package com.brewery.pillwidget

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.ceil
import kotlin.math.floor

class ChartRenderer {

    companion object {
        private const val COLOR_BACKGROUND = "#1a1a2e"
        private const val COLOR_GRAVITY = "#f59e0b"
        private const val COLOR_TEMP = "#3b82f6"
        private const val COLOR_GRID = "#333355"
        private const val COLOR_LABEL = "#aaaacc"
        private const val COLOR_LEGEND_BG = "#252545"

        private const val MARGIN_LEFT = 80f
        private const val MARGIN_RIGHT = 70f
        private const val MARGIN_TOP = 30f
        private const val MARGIN_BOTTOM = 50f
    }

    fun render(readings: List<Reading>, widthPx: Int, heightPx: Int): Bitmap {
        val bitmap = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.parseColor(COLOR_BACKGROUND))

        if (readings.isEmpty()) return bitmap

        if (readings.size == 1) {
            drawSingleReading(canvas, readings[0], widthPx, heightPx)
            return bitmap
        }

        val chartLeft = MARGIN_LEFT
        val chartRight = widthPx - MARGIN_RIGHT
        val chartTop = MARGIN_TOP
        val chartBottom = heightPx - MARGIN_BOTTOM

        // Data ranges
        val sgMin = readings.minOf { it.specificGravity } - 0.002
        val sgMax = readings.maxOf { it.specificGravity } + 0.002
        val tempMinRaw = readings.minOf { it.temperatureC }
        val tempMaxRaw = readings.maxOf { it.temperatureC }
        val tempMin = floor(tempMinRaw) - 1.0
        val tempMax = ceil(tempMaxRaw) + 1.0
        val timeMin = readings.minOf { it.timestamp }
        val timeMax = readings.maxOf { it.timestamp }
        val timeRange = (timeMax - timeMin).coerceAtLeast(1L)

        fun mapX(time: Long): Float =
            chartLeft + (time - timeMin).toFloat() / timeRange * (chartRight - chartLeft)

        fun mapYGravity(sg: Double): Float {
            val range = (sgMax - sgMin).coerceAtLeast(0.001)
            return chartBottom - ((sg - sgMin) / range * (chartBottom - chartTop)).toFloat()
        }

        fun mapYTemp(temp: Double): Float {
            val range = (tempMax - tempMin).coerceAtLeast(1.0)
            return chartBottom - ((temp - tempMin) / range * (chartBottom - chartTop)).toFloat()
        }

        // Grid lines (horizontal, based on gravity ticks)
        val gridPaint = Paint().apply {
            color = Color.parseColor(COLOR_GRID)
            strokeWidth = 1f
            style = Paint.Style.STROKE
            pathEffect = DashPathEffect(floatArrayOf(6f, 4f), 0f)
            isAntiAlias = true
        }

        val sgRange = sgMax - sgMin
        val sgStep = chooseSgStep(sgRange)
        val firstSgTick = ceil(sgMin / sgStep) * sgStep
        var sg = firstSgTick
        while (sg <= sgMax) {
            val y = mapYGravity(sg)
            canvas.drawLine(chartLeft, y, chartRight, y, gridPaint)
            sg += sgStep
        }

        // Gravity line
        val gravityPaint = Paint().apply {
            color = Color.parseColor(COLOR_GRAVITY)
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

        // Temperature line (dashed)
        val tempPaint = Paint().apply {
            color = Color.parseColor(COLOR_TEMP)
            strokeWidth = 2.5f
            style = Paint.Style.STROKE
            isAntiAlias = true
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
            pathEffect = DashPathEffect(floatArrayOf(8f, 4f), 0f)
        }
        val tempPath = Path()
        readings.forEachIndexed { i, r ->
            val x = mapX(r.timestamp)
            val y = mapYTemp(r.temperatureC)
            if (i == 0) tempPath.moveTo(x, y) else tempPath.lineTo(x, y)
        }
        canvas.drawPath(tempPath, tempPaint)

        // Axis labels
        val labelPaint = Paint().apply {
            color = Color.parseColor(COLOR_LABEL)
            textSize = 20f
            isAntiAlias = true
        }

        // Left Y-axis labels (SG) - colored amber
        val sgLabelPaint = Paint(labelPaint).apply {
            color = Color.parseColor(COLOR_GRAVITY)
            textAlign = Paint.Align.RIGHT
        }
        sg = firstSgTick
        while (sg <= sgMax) {
            val y = mapYGravity(sg)
            canvas.drawText("%.3f".format(sg), chartLeft - 8f, y + 6f, sgLabelPaint)
            sg += sgStep
        }

        // Right Y-axis labels (Temp) - colored blue
        val tempLabelPaint = Paint(labelPaint).apply {
            color = Color.parseColor(COLOR_TEMP)
            textAlign = Paint.Align.LEFT
        }
        val tempStep = chooseTempStep(tempMax - tempMin)
        val firstTempTick = ceil(tempMin / tempStep) * tempStep
        var temp = firstTempTick
        while (temp <= tempMax) {
            val y = mapYTemp(temp)
            canvas.drawText("%.0f°".format(temp), chartRight + 8f, y + 6f, tempLabelPaint)
            temp += tempStep
        }

        // X-axis labels (date/time)
        val timeLabelPaint = Paint(labelPaint).apply {
            textAlign = Paint.Align.CENTER
            textSize = 18f
        }
        val timeSpanMs = timeMax - timeMin
        val dateFormat = if (timeSpanMs > 2 * 86400_000L) {
            SimpleDateFormat("MMM d", Locale.US)
        } else {
            SimpleDateFormat("HH:mm", Locale.US)
        }
        val numTimeLabels = ((chartRight - chartLeft) / 120f).toInt().coerceIn(2, 8)
        for (i in 0..numTimeLabels) {
            val t = timeMin + timeSpanMs * i / numTimeLabels
            val x = mapX(t)
            val label = dateFormat.format(Date(t))
            canvas.drawText(label, x, chartBottom + 30f, timeLabelPaint)
        }

        // Legend
        drawLegend(canvas, chartLeft, chartTop)

        return bitmap
    }

    private fun drawSingleReading(canvas: Canvas, reading: Reading, widthPx: Int, heightPx: Int) {
        val cx = widthPx / 2f
        val cy = heightPx / 2f

        // Gravity dot
        val dotPaint = Paint().apply {
            color = Color.parseColor(COLOR_GRAVITY)
            style = Paint.Style.FILL
            isAntiAlias = true
        }
        canvas.drawCircle(cx - 30f, cy - 20f, 8f, dotPaint)

        // Temp dot
        val tempDotPaint = Paint().apply {
            color = Color.parseColor(COLOR_TEMP)
            style = Paint.Style.FILL
            isAntiAlias = true
        }
        canvas.drawCircle(cx - 30f, cy + 20f, 8f, tempDotPaint)

        // Labels
        val textPaint = Paint().apply {
            color = Color.parseColor(COLOR_LABEL)
            textSize = 22f
            isAntiAlias = true
        }
        canvas.drawText("SG: %.4f".format(reading.specificGravity), cx - 10f, cy - 13f, textPaint)
        canvas.drawText("Temp: %.1f°C".format(reading.temperatureC), cx - 10f, cy + 27f, textPaint)

        val dateFormat = SimpleDateFormat("MMM d HH:mm", Locale.US)
        val timePaint = Paint(textPaint).apply { textAlign = Paint.Align.CENTER; textSize = 18f }
        canvas.drawText(dateFormat.format(Date(reading.timestamp)), cx, cy + 60f, timePaint)
    }

    private fun drawLegend(canvas: Canvas, chartLeft: Float, chartTop: Float) {
        val legendX = chartLeft + 10f
        val legendY = chartTop + 2f

        val bgPaint = Paint().apply {
            color = Color.parseColor(COLOR_LEGEND_BG)
            style = Paint.Style.FILL
            isAntiAlias = true
        }
        canvas.drawRoundRect(legendX - 4f, legendY - 12f, legendX + 180f, legendY + 16f, 4f, 4f, bgPaint)

        val textSize = 16f

        // Gravity legend
        val gravLinePaint = Paint().apply {
            color = Color.parseColor(COLOR_GRAVITY)
            strokeWidth = 4f
            style = Paint.Style.STROKE
            isAntiAlias = true
            strokeCap = Paint.Cap.ROUND
        }
        canvas.drawLine(legendX, legendY, legendX + 20f, legendY, gravLinePaint)

        val legendTextPaint = Paint().apply {
            color = Color.parseColor(COLOR_LABEL)
            this.textSize = textSize
            isAntiAlias = true
        }
        canvas.drawText("SG", legendX + 25f, legendY + 5f, legendTextPaint)

        // Temp legend
        val tempLinePaint = Paint().apply {
            color = Color.parseColor(COLOR_TEMP)
            strokeWidth = 2.5f
            style = Paint.Style.STROKE
            isAntiAlias = true
            strokeCap = Paint.Cap.ROUND
            pathEffect = DashPathEffect(floatArrayOf(8f, 4f), 0f)
        }
        val tempLegendX = legendX + 60f
        canvas.drawLine(tempLegendX, legendY, tempLegendX + 20f, legendY, tempLinePaint)
        canvas.drawText("Temp", tempLegendX + 25f, legendY + 5f, legendTextPaint)
    }

    private fun chooseSgStep(range: Double): Double = when {
        range <= 0.010 -> 0.002
        range <= 0.025 -> 0.005
        range <= 0.060 -> 0.010
        else -> 0.020
    }

    private fun chooseTempStep(range: Double): Double = when {
        range <= 5.0 -> 1.0
        range <= 15.0 -> 2.0
        range <= 30.0 -> 5.0
        else -> 10.0
    }
}
