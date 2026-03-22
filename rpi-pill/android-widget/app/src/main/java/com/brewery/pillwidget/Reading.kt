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
