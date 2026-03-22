package com.brewery.pillwidget

import android.app.Activity
import android.graphics.Bitmap
import android.os.Bundle
import android.widget.ImageView
import android.widget.TextView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class DetailActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_detail)

        val chartImage = findViewById<ImageView>(R.id.detail_chart_image)
        val gravityText = findViewById<TextView>(R.id.detail_gravity_text)
        val tempText = findViewById<TextView>(R.id.detail_temp_text)
        val updatedText = findViewById<TextView>(R.id.detail_updated_text)

        updatedText.text = "Loading..."

        val prefs = PrefsRepository(this)
        val baseUrl = prefs.getBaseUrl()
        if (baseUrl == null) {
            updatedText.text = "No server configured"
            return
        }
        val fallbackUrl = prefs.getFallbackUrl()
        val pillName = prefs.getPillName()

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val client = ApiClient(baseUrl, fallbackUrl)
                val readingDtos = withContext(Dispatchers.IO) {
                    client.getReadings(limit = 500, pill = pillName)
                }
                val readings = readingDtos.map { it.toReading() }
                val latest = readings.lastOrNull()

                if (latest != null) {
                    gravityText.text = "SG: %.4f".format(latest.specificGravity)
                    tempText.text = "Temp: %.1f\u00B0C".format(latest.temperatureC)
                    updatedText.text = "${readings.size} readings"
                } else {
                    updatedText.text = "No readings available"
                }

                if (readings.isNotEmpty()) {
                    val display = resources.displayMetrics
                    val width = display.widthPixels - (32 * display.density).toInt()
                    val height = (width * 0.6).toInt()
                    val bitmap: Bitmap = ChartRenderer().render(readings, width, height)
                    chartImage.setImageBitmap(bitmap)
                }
            } catch (e: Exception) {
                updatedText.text = "Error: ${e.message}"
            }
        }
    }
}
