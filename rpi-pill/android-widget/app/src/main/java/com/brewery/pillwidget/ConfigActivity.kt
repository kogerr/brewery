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

        setResult(RESULT_CANCELED)

        appWidgetId = intent?.extras?.getInt(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID

        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }

        val hostInput = findViewById<EditText>(R.id.host_input)
        val fallbackInput = findViewById<EditText>(R.id.fallback_input)
        val pillInput = findViewById<EditText>(R.id.pill_input)
        val saveButton = findViewById<Button>(R.id.save_button)

        val prefs = PrefsRepository(this)
        hostInput.setText(prefs.getBaseUrl() ?: "http://192.168.1.")
        fallbackInput.setText(prefs.getFallbackUrl() ?: "")
        pillInput.setText(prefs.getPillName() ?: "")

        saveButton.setOnClickListener {
            val url = hostInput.text.toString().trimEnd('/')
            prefs.setBaseUrl(url)

            val fallback = fallbackInput.text.toString().trimEnd('/')
            if (fallback.isNotBlank()) {
                prefs.setFallbackUrl(fallback)
            }

            val pill = pillInput.text.toString().trim()
            prefs.setPillName(pill)

            PillWidgetProvider.enqueueOneTimeUpdate(this)

            val result = Intent().putExtra(
                AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId
            )
            setResult(RESULT_OK, result)
            finish()
        }
    }
}
