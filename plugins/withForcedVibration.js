const fs = require('fs');
const path = require('path');
const {withDangerousMod} = require('@expo/config-plugins');

const PACKAGE_NAME = 'berlin.spengler.aftertouch.app';
const PACKAGE_PATH = path.join('berlin', 'spengler', 'aftertouch', 'app');

const moduleSource = `package ${PACKAGE_NAME}

import android.content.Context
import android.media.AudioAttributes
import android.os.Build
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ForcedVibrationModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "ForcedVibration"

  @ReactMethod
  fun vibrate(durationMs: Double) {
    val duration = durationMs.toLong().coerceIn(1L, 2000L)
    val effect = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE)
    } else {
      null
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val manager = reactContext.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
      val vibrator = manager.defaultVibrator
      if (!vibrator.hasVibrator()) {
        return
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && effect != null) {
        val attributes = VibrationAttributes.Builder()
          .setUsage(VibrationAttributes.USAGE_ALARM)
          .build()
        vibrator.vibrate(effect, attributes)
        return
      }

      vibrateLegacy(vibrator, effect, duration)
      return
    }

    @Suppress("DEPRECATION")
    val vibrator = reactContext.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    if (!vibrator.hasVibrator()) {
      return
    }
    vibrateLegacy(vibrator, effect, duration)
  }

  private fun vibrateLegacy(vibrator: Vibrator, effect: VibrationEffect?, duration: Long) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && effect != null) {
      val attributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ALARM)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
      vibrator.vibrate(effect, attributes)
      return
    }

    @Suppress("DEPRECATION")
    vibrator.vibrate(duration)
  }
}
`;

const packageSource = `package ${PACKAGE_NAME}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class ForcedVibrationPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(ForcedVibrationModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
`;

function writeNativeModule(androidRoot) {
  const javaDir = path.join(androidRoot, 'app', 'src', 'main', 'java', ...PACKAGE_PATH.split(path.sep));
  fs.mkdirSync(javaDir, {recursive: true});
  fs.writeFileSync(path.join(javaDir, 'ForcedVibrationModule.kt'), moduleSource);
  fs.writeFileSync(path.join(javaDir, 'ForcedVibrationPackage.kt'), packageSource);
}

function registerPackage(androidRoot) {
  const mainApplicationPath = path.join(androidRoot, 'app', 'src', 'main', 'java', ...PACKAGE_PATH.split(path.sep), 'MainApplication.kt');
  let source = fs.readFileSync(mainApplicationPath, 'utf8');
  const registration = 'add(berlin.spengler.aftertouch.app.ForcedVibrationPackage())';

  if (source.includes(registration)) {
    return;
  }

  source = source.replace(
    '          // add(MyReactNativePackage())',
    '          // add(MyReactNativePackage())\n          ' + registration
  );
  fs.writeFileSync(mainApplicationPath, source);
}

module.exports = function withForcedVibration(config) {
  return withDangerousMod(config, ['android', async (modConfig) => {
    const androidRoot = modConfig.modRequest.platformProjectRoot;
    writeNativeModule(androidRoot);
    registerPackage(androidRoot);
    return modConfig;
  }]);
};
