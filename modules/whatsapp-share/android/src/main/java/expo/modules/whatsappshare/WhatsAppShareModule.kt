package expo.modules.whatsappshare

import android.content.ClipData
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Sends one file straight to an app (WhatsApp) with a real share intent: the file
// as an EXTRA_STREAM Uri plus ClipData, so the read grant reaches the receiver.
// expo-intent-launcher can only pass extras as strings, which WhatsApp ignores.
class WhatsAppShareModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WhatsAppShare")

    // The first of `packages` that is installed, or null. The app's manifest must list
    // them under <queries> (Android 11+), or every check answers "not installed".
    Function("installedPackage") { packages: List<String> ->
      val pm = appContext.reactContext?.packageManager ?: throw Exceptions.ReactContextLost()
      packages.firstOrNull { name ->
        try {
          pm.getPackageInfo(name, 0); true
        } catch (_: PackageManager.NameNotFoundException) {
          false
        }
      }
    }

    // Opens `packageName`'s own share screen with the file. Throws when the app has no
    // screen that accepts this file type, with Android's own message.
    AsyncFunction("share") { contentUri: String, mimeType: String, packageName: String ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      val uri = Uri.parse(contentUri)
      val intent = Intent(Intent.ACTION_SEND).apply {
        type = mimeType
        setPackage(packageName)
        putExtra(Intent.EXTRA_STREAM, uri)
        clipData = ClipData.newRawUri(null, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      try {
        activity.startActivity(intent)
      } catch (e: Exception) {
        throw CodedException("ERR_SHARE", "$packageName could not open the file: ${e.message}", e)
      }
    }.runOnQueue(Queues.MAIN)
  }
}
