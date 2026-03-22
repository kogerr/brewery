package com.brewery.pillwidget

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import java.util.concurrent.TimeUnit

class ApiClient(private val baseUrl: String, private val fallbackUrl: String? = null) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    private val json = Json { ignoreUnknownKeys = true }

    private suspend fun <T> fetchWithFallback(path: String, parse: (String) -> T): T =
        withContext(Dispatchers.IO) {
            try {
                val body = fetch("$baseUrl$path")
                parse(body)
            } catch (e: Exception) {
                if (fallbackUrl != null) {
                    val body = fetch("$fallbackUrl$path")
                    parse(body)
                } else {
                    throw e
                }
            }
        }

    private fun fetch(url: String): String {
        val request = Request.Builder().url(url).build()
        val response = client.newCall(request).execute()
        return response.body?.string() ?: throw IOException("Empty response")
    }

    suspend fun getReadings(limit: Int = 500, pill: String? = null): List<ReadingDto> {
        val pillParam = if (pill != null) "&pill=${java.net.URLEncoder.encode(pill, "UTF-8")}" else ""
        return fetchWithFallback("/api/readings?limit=$limit$pillParam") { body ->
            json.decodeFromString<List<ReadingDto>>(body)
        }
    }

    suspend fun getLatestReading(pill: String? = null): ReadingDto? {
        val pillParam = if (pill != null) "?pill=${java.net.URLEncoder.encode(pill, "UTF-8")}" else ""
        return fetchWithFallback("/api/readings/latest$pillParam") { body ->
            if (body == "null") null else json.decodeFromString<ReadingDto>(body)
        }
    }
}
