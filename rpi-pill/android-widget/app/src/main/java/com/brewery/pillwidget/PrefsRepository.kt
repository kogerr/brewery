package com.brewery.pillwidget

import android.content.Context

class PrefsRepository(context: Context) {
    private val prefs = context.getSharedPreferences("pill_widget", Context.MODE_PRIVATE)

    fun getBaseUrl(): String? = prefs.getString("base_url", null)

    fun setBaseUrl(url: String) {
        prefs.edit().putString("base_url", url).apply()
    }

    fun getFallbackUrl(): String? = prefs.getString("fallback_url", null)

    fun setFallbackUrl(url: String) {
        prefs.edit().putString("fallback_url", url).apply()
    }

    fun getPillName(): String? = prefs.getString("pill_name", null)?.ifBlank { null }

    fun setPillName(name: String) {
        prefs.edit().putString("pill_name", name).apply()
    }
}
