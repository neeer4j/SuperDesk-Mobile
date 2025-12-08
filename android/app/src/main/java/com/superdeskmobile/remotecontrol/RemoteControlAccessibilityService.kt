package com.superdeskmobile.remotecontrol

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import androidx.annotation.RequiresApi

/**
 * Accessibility Service that enables remote control of the Android device.
 * Allows injecting touch events (taps, swipes, gestures) from remote commands.
 * 
 * IMPORTANT: User must manually enable this service in:
 * Settings → Accessibility → SuperDesk Remote Control → Enable
 */
class RemoteControlAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "RemoteControlService"
        
        // Singleton instance for sending commands
        var instance: RemoteControlAccessibilityService? = null
            private set
        
        // Screen dimensions (will be set on service start)
        var screenWidth: Int = 1080
        var screenHeight: Int = 1920
        
        /**
         * Check if the accessibility service is enabled and running.
         */
        fun isServiceEnabled(): Boolean {
            return instance != null
        }
        
        /**
         * Perform a tap at normalized coordinates (0.0-1.0).
         */
        fun performTap(normalizedX: Float, normalizedY: Float): Boolean {
            val service = instance ?: return false
            val x = (normalizedX * screenWidth).toInt().coerceIn(0, screenWidth)
            val y = (normalizedY * screenHeight).toInt().coerceIn(0, screenHeight)
            return service.performTapAt(x, y)
        }
        
        /**
         * Perform a swipe from one point to another.
         */
        fun performSwipe(
            startX: Float, startY: Float,
            endX: Float, endY: Float,
            durationMs: Long = 300
        ): Boolean {
            val service = instance ?: return false
            val sX = (startX * screenWidth).toInt().coerceIn(0, screenWidth)
            val sY = (startY * screenHeight).toInt().coerceIn(0, screenHeight)
            val eX = (endX * screenWidth).toInt().coerceIn(0, screenWidth)
            val eY = (endY * screenHeight).toInt().coerceIn(0, screenHeight)
            return service.performSwipeGesture(sX, sY, eX, eY, durationMs)
        }
        
        /**
         * Perform a long press at normalized coordinates.
         */
        fun performLongPress(normalizedX: Float, normalizedY: Float): Boolean {
            val service = instance ?: return false
            val x = (normalizedX * screenWidth).toInt().coerceIn(0, screenWidth)
            val y = (normalizedY * screenHeight).toInt().coerceIn(0, screenHeight)
            return service.performLongPressAt(x, y)
        }
        
        /**
         * Perform scroll action.
         */
        fun performScroll(
            normalizedX: Float, normalizedY: Float,
            deltaX: Float, deltaY: Float
        ): Boolean {
            val service = instance ?: return false
            val x = (normalizedX * screenWidth).toInt().coerceIn(0, screenWidth)
            val y = (normalizedY * screenHeight).toInt().coerceIn(0, screenHeight)
            // Convert delta to end points (negative delta = scroll up/left)
            val endX = (x - deltaX * 0.5f).toInt().coerceIn(0, screenWidth)
            val endY = (y - deltaY * 0.5f).toInt().coerceIn(0, screenHeight)
            return service.performSwipeGesture(x, y, endX, endY, 100)
        }
        
        /**
         * Perform global action (back, home, recents, etc.)
         */
        fun performGlobalAction(action: String): Boolean {
            val service = instance ?: return false
            return when (action.lowercase()) {
                "back" -> service.performGlobalAction(GLOBAL_ACTION_BACK)
                "home" -> service.performGlobalAction(GLOBAL_ACTION_HOME)
                "recents" -> service.performGlobalAction(GLOBAL_ACTION_RECENTS)
                "notifications" -> service.performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)
                "quicksettings" -> service.performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS)
                "powerdialog" -> service.performGlobalAction(GLOBAL_ACTION_POWER_DIALOG)
                else -> false
            }
        }
    }

    private val handler = Handler(Looper.getMainLooper())

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        updateScreenDimensions()
        Log.i(TAG, "Remote Control Accessibility Service connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // We don't need to handle accessibility events
        // This service is only for injecting gestures
    }

    override fun onInterrupt() {
        Log.w(TAG, "Remote Control Accessibility Service interrupted")
    }

    override fun onDestroy() {
        instance = null
        Log.i(TAG, "Remote Control Accessibility Service destroyed")
        super.onDestroy()
    }

    private fun updateScreenDimensions() {
        try {
            val windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val bounds = windowManager.currentWindowMetrics.bounds
                screenWidth = bounds.width()
                screenHeight = bounds.height()
            } else {
                val metrics = DisplayMetrics()
                @Suppress("DEPRECATION")
                windowManager.defaultDisplay.getMetrics(metrics)
                screenWidth = metrics.widthPixels
                screenHeight = metrics.heightPixels
            }
            Log.d(TAG, "Screen dimensions: ${screenWidth}x${screenHeight}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get screen dimensions", e)
        }
    }

    /**
     * Perform a tap gesture at specific screen coordinates.
     */
    @RequiresApi(Build.VERSION_CODES.N)
    private fun performTapAt(x: Int, y: Int): Boolean {
        Log.d(TAG, "Performing tap at ($x, $y)")
        
        val path = Path()
        path.moveTo(x.toFloat(), y.toFloat())
        
        val gestureBuilder = GestureDescription.Builder()
        gestureBuilder.addStroke(GestureDescription.StrokeDescription(path, 0, 100))
        
        return dispatchGesture(
            gestureBuilder.build(),
            object : GestureResultCallback() {
                override fun onCompleted(gestureDescription: GestureDescription?) {
                    Log.d(TAG, "Tap completed at ($x, $y)")
                }
                override fun onCancelled(gestureDescription: GestureDescription?) {
                    Log.w(TAG, "Tap cancelled at ($x, $y)")
                }
            },
            handler
        )
    }

    /**
     * Perform a long press gesture at specific screen coordinates.
     */
    @RequiresApi(Build.VERSION_CODES.N)
    private fun performLongPressAt(x: Int, y: Int): Boolean {
        Log.d(TAG, "Performing long press at ($x, $y)")
        
        val path = Path()
        path.moveTo(x.toFloat(), y.toFloat())
        
        val gestureBuilder = GestureDescription.Builder()
        // Long press: 500ms duration at same point
        gestureBuilder.addStroke(GestureDescription.StrokeDescription(path, 0, 500))
        
        return dispatchGesture(
            gestureBuilder.build(),
            object : GestureResultCallback() {
                override fun onCompleted(gestureDescription: GestureDescription?) {
                    Log.d(TAG, "Long press completed at ($x, $y)")
                }
                override fun onCancelled(gestureDescription: GestureDescription?) {
                    Log.w(TAG, "Long press cancelled at ($x, $y)")
                }
            },
            handler
        )
    }

    /**
     * Perform a swipe gesture from start to end coordinates.
     */
    @RequiresApi(Build.VERSION_CODES.N)
    private fun performSwipeGesture(
        startX: Int, startY: Int,
        endX: Int, endY: Int,
        durationMs: Long
    ): Boolean {
        Log.d(TAG, "Performing swipe from ($startX, $startY) to ($endX, $endY)")
        
        val path = Path()
        path.moveTo(startX.toFloat(), startY.toFloat())
        path.lineTo(endX.toFloat(), endY.toFloat())
        
        val gestureBuilder = GestureDescription.Builder()
        gestureBuilder.addStroke(GestureDescription.StrokeDescription(path, 0, durationMs))
        
        return dispatchGesture(
            gestureBuilder.build(),
            object : GestureResultCallback() {
                override fun onCompleted(gestureDescription: GestureDescription?) {
                    Log.d(TAG, "Swipe completed")
                }
                override fun onCancelled(gestureDescription: GestureDescription?) {
                    Log.w(TAG, "Swipe cancelled")
                }
            },
            handler
        )
    }
}
