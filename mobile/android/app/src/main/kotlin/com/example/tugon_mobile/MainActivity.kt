package com.example.tugon_mobile

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // High-importance channel so TUGON alerts pop up on screen (heads-up), not only in the tray.
        // Its id must match the server's android.notification.channelId and the manifest default.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel("tugon_alerts", "TUGON alerts", NotificationManager.IMPORTANCE_HIGH)
            channel.description = "Report updates and dispatch alerts from MDRRMO Mabini"
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }
}
