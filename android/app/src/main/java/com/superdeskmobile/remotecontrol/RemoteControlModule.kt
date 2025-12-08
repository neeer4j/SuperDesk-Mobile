package com.superdeskmobile.remotecontrol

import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.*

/**
 * React Native bridge module for the Remote Control Accessibility Service.
 * Exposes methods to check service status and send control commands.
 */
class RemoteControlModule(reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "RemoteControlModule"

    /**
     * Check if the accessibility service is enabled.
     */
    @ReactMethod
    fun isServiceEnabled(promise: Promise) {
        promise.resolve(RemoteControlAccessibilityService.isServiceEnabled())
    }

    /**
     * Open Android Accessibility Settings so user can enable the service.
     */
    @ReactMethod
    fun openAccessibilitySettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SETTINGS_ERROR", e.message)
        }
    }

    /**
     * Get current screen dimensions.
     */
    @ReactMethod
    fun getScreenDimensions(promise: Promise) {
        val result = Arguments.createMap()
        result.putInt("width", RemoteControlAccessibilityService.screenWidth)
        result.putInt("height", RemoteControlAccessibilityService.screenHeight)
        promise.resolve(result)
    }

    /**
     * Perform a tap at normalized coordinates (0.0-1.0).
     */
    @ReactMethod
    fun performTap(x: Double, y: Double, promise: Promise) {
        if (!RemoteControlAccessibilityService.isServiceEnabled()) {
            promise.reject("SERVICE_DISABLED", "Accessibility service is not enabled")
            return
        }
        
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            promise.reject("UNSUPPORTED", "Gesture injection requires Android 7.0+")
            return
        }
        
        val success = RemoteControlAccessibilityService.performTap(x.toFloat(), y.toFloat())
        promise.resolve(success)
    }

    /**
     * Perform a long press at normalized coordinates.
     */
    @ReactMethod
    fun performLongPress(x: Double, y: Double, promise: Promise) {
        if (!RemoteControlAccessibilityService.isServiceEnabled()) {
            promise.reject("SERVICE_DISABLED", "Accessibility service is not enabled")
            return
        }
        
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            promise.reject("UNSUPPORTED", "Gesture injection requires Android 7.0+")
            return
        }
        
        val success = RemoteControlAccessibilityService.performLongPress(x.toFloat(), y.toFloat())
        promise.resolve(success)
    }

    /**
     * Perform a swipe gesture.
     */
    @ReactMethod
    fun performSwipe(
        startX: Double, startY: Double,
        endX: Double, endY: Double,
        durationMs: Int,
        promise: Promise
    ) {
        if (!RemoteControlAccessibilityService.isServiceEnabled()) {
            promise.reject("SERVICE_DISABLED", "Accessibility service is not enabled")
            return
        }
        
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            promise.reject("UNSUPPORTED", "Gesture injection requires Android 7.0+")
            return
        }
        
        val success = RemoteControlAccessibilityService.performSwipe(
            startX.toFloat(), startY.toFloat(),
            endX.toFloat(), endY.toFloat(),
            durationMs.toLong()
        )
        promise.resolve(success)
    }

    /**
     * Perform scroll at a position.
     */
    @ReactMethod
    fun performScroll(x: Double, y: Double, deltaX: Double, deltaY: Double, promise: Promise) {
        if (!RemoteControlAccessibilityService.isServiceEnabled()) {
            promise.reject("SERVICE_DISABLED", "Accessibility service is not enabled")
            return
        }
        
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            promise.reject("UNSUPPORTED", "Gesture injection requires Android 7.0+")
            return
        }
        
        val success = RemoteControlAccessibilityService.performScroll(
            x.toFloat(), y.toFloat(),
            deltaX.toFloat(), deltaY.toFloat()
        )
        promise.resolve(success)
    }

    /**
     * Perform a global action (back, home, recents, etc.)
     */
    @ReactMethod
    fun performGlobalAction(action: String, promise: Promise) {
        if (!RemoteControlAccessibilityService.isServiceEnabled()) {
            promise.reject("SERVICE_DISABLED", "Accessibility service is not enabled")
            return
        }
        
        val success = RemoteControlAccessibilityService.performGlobalAction(action)
        promise.resolve(success)
    }
}
