package com.superdeskmobile

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.superdeskmobile.screencapture.ScreenCapturePackage
import com.superdeskmobile.remotecontrol.RemoteControlPackage
import com.oney.WebRTCModule.WebRTCModuleOptions

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Add our custom packages
          add(ScreenCapturePackage())
          add(RemoteControlPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    
    // CRITICAL: Enable screen sharing for react-native-webrtc
    // Without this, getDisplayMedia() returns tracks that never produce frames
    val options = WebRTCModuleOptions.getInstance()
    options.enableMediaProjectionService = true
    
    loadReactNative(this)
  }
}
