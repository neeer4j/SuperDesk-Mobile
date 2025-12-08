package com.superdeskmobile.screencapture

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * React Native bridge module for screen capture functionality.
 * Exposes MediaProjection screen capture to JavaScript.
 */
class ScreenCaptureModule(reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    companion object {
        const val NAME = "ScreenCaptureModule"
        const val REQUEST_CODE_SCREEN_CAPTURE = 1000
        const val EVENT_FRAME_CAPTURED = "onFrameCaptured"
        const val EVENT_CAPTURE_STOPPED = "onCaptureStopped"
        const val EVENT_CAPTURE_ERROR = "onCaptureError"
    }

    private var capturePromise: Promise? = null

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String = NAME

    override fun getConstants(): MutableMap<String, Any> {
        return mutableMapOf(
            "EVENT_FRAME_CAPTURED" to EVENT_FRAME_CAPTURED,
            "EVENT_CAPTURE_STOPPED" to EVENT_CAPTURE_STOPPED,
            "EVENT_CAPTURE_ERROR" to EVENT_CAPTURE_ERROR
        )
    }

    /**
     * Request screen capture permission from the user.
     * This will show a system dialog asking for permission.
     */
    @ReactMethod
    fun requestPermission(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No activity available")
            return
        }

        capturePromise = promise
        
        val projectionManager = activity.getSystemService(
            Activity.MEDIA_PROJECTION_SERVICE
        ) as MediaProjectionManager
        
        val captureIntent = projectionManager.createScreenCaptureIntent()
        activity.startActivityForResult(captureIntent, REQUEST_CODE_SCREEN_CAPTURE)
    }

    /**
     * Start screen capture after permission is granted.
     */
    @ReactMethod
    fun startCapture(promise: Promise) {
        if (!ScreenCaptureService.isRunning) {
            promise.reject("NOT_STARTED", "Screen capture not initialized. Call requestPermission first.")
            return
        }
        
        // Set up frame callback
        ScreenCaptureService.onFrameCallback = { base64Frame ->
            sendEvent(EVENT_FRAME_CAPTURED, base64Frame)
        }
        
        promise.resolve(true)
    }

    /**
     * Stop screen capture.
     */
    @ReactMethod
    fun stopCapture(promise: Promise) {
        try {
            ScreenCaptureService.stopCapture(reactApplicationContext)
            ScreenCaptureService.onFrameCallback = null
            sendEvent(EVENT_CAPTURE_STOPPED, null)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e.message)
        }
    }

    /**
     * Check if screen capture is currently running.
     */
    @ReactMethod
    fun isCapturing(promise: Promise) {
        promise.resolve(ScreenCaptureService.isRunning)
    }

    /**
     * Add listener for events (required by RN event emitter).
     */
    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN built-in event emitter
    }

    /**
     * Remove listeners (required by RN event emitter).
     */
    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN built-in event emitter
    }

    private fun sendEvent(eventName: String, data: Any?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, data)
    }

    override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {
        if (requestCode != REQUEST_CODE_SCREEN_CAPTURE) return
        
        val promise = capturePromise
        capturePromise = null
        
        if (resultCode == Activity.RESULT_OK && data != null) {
            // Start the capture service
            ScreenCaptureService.startCapture(reactApplicationContext, resultCode, data)
            promise?.resolve(true)
        } else {
            promise?.reject("PERMISSION_DENIED", "Screen capture permission denied")
        }
    }

    override fun onNewIntent(intent: Intent) {
        // Not used
    }
}
