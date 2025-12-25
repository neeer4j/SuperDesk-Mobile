package com.superdeskmobile.remotecontrol

import android.provider.Settings
import android.content.Context
import android.util.Log
import com.facebook.react.bridge.*
import android.os.Build
import android.content.Intent

class RemoteControlModule(reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "RemoteControlModule"

    private fun isEnabledInSettings(): Boolean {
        val context = reactApplicationContext
        val enabledServices = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: ""
        return enabledServices.contains(context.packageName)
    }

    @ReactMethod
    fun isServiceEnabled(promise: Promise) {
        val active = RemoteControlAccessibilityService.isServiceEnabled()
        val enabled = isEnabledInSettings()
        Log.i("RemoteControlModule", "isServiceEnabled: active=$active, enabled=$enabled")
        promise.resolve(active || enabled)
    }

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

    @ReactMethod
    fun getScreenDimensions(promise: Promise) {
        val result = Arguments.createMap()
        result.putInt("width", RemoteControlAccessibilityService.screenWidth)
        result.putInt("height", RemoteControlAccessibilityService.screenHeight)
        promise.resolve(result)
    }

    private fun checkServiceStatus(): String? {
        if (RemoteControlAccessibilityService.isServiceEnabled()) return null
        if (isEnabledInSettings()) return "SERVICE_STARTING"
        return "SERVICE_DISABLED"
    }

    @ReactMethod
    fun performTap(x: Double, y: Double, promise: Promise) {
        val status = checkServiceStatus()
        if (status == "SERVICE_DISABLED") {
            promise.reject("SERVICE_DISABLED", "Accessibility service is not enabled")
            return
        }
        val success = RemoteControlAccessibilityService.performTap(x.toFloat(), y.toFloat())
        promise.resolve(success)
    }

    @ReactMethod
    fun performLongPress(x: Double, y: Double, promise: Promise) {
        if (checkServiceStatus() == "SERVICE_DISABLED") {
            promise.reject("SERVICE_DISABLED", "Accessibility service is not enabled")
            return
        }
        val success = RemoteControlAccessibilityService.performLongPress(x.toFloat(), y.toFloat())
        promise.resolve(success)
    }

    @ReactMethod
    fun performSwipe(startX: Double, startY: Double, endX: Double, endY: Double, durationMs: Int, promise: Promise) {
        if (checkServiceStatus() == "SERVICE_DISABLED") {
            promise.reject("SERVICE_DISABLED", "Accessibility service is not enabled")
            return
        }
        val success = RemoteControlAccessibilityService.performSwipe(
            startX.toFloat(), startY.toFloat(),
            endX.toFloat(), endY.toFloat(),
            durationMs.toLong()
        )
        promise.resolve(success)
    }

    @ReactMethod
    fun performScroll(x: Double, y: Double, deltaX: Double, deltaY: Double, promise: Promise) {
        if (checkServiceStatus() == "SERVICE_DISABLED") {
            promise.reject("SERVICE_DISABLED", "Accessibility service is not enabled")
            return
        }
        val success = RemoteControlAccessibilityService.performScroll(
            x.toFloat(), y.toFloat(),
            deltaX.toFloat(), deltaY.toFloat()
        )
        promise.resolve(success)
    }

    @ReactMethod
    fun performGlobalAction(action: String, promise: Promise) {
        if (checkServiceStatus() == "SERVICE_DISABLED") {
            promise.reject("SERVICE_DISABLED", "Accessibility service is not enabled")
            return
        }
        val success = RemoteControlAccessibilityService.performGlobalAction(action)
        promise.resolve(success)
    }

    @ReactMethod
    fun injectText(text: String, promise: Promise) {
        if (checkServiceStatus() == "SERVICE_DISABLED") {
            promise.reject("SERVICE_DISABLED", "Accessibility service is not enabled")
            return
        }
        val success = RemoteControlAccessibilityService.injectText(text)
        promise.resolve(success)
    }
}
