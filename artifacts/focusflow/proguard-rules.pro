# ─── FocusFlow ProGuard / R8 Rules ───────────────────────────────────────────
# R8 is the default shrinker/minifier for release builds.
# These rules prevent stripping classes that are accessed via reflection,
# JNI, or dynamic dispatch by React Native and Expo modules.

# ── React Native core ─────────────────────────────────────────────────────────
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.soloader.** { *; }
-dontwarn com.facebook.react.**
-dontwarn com.facebook.hermes.**

# ── Hermes JS engine ──────────────────────────────────────────────────────────
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.hermes.reactexecutor.** { *; }

# ── Expo core & modules ───────────────────────────────────────────────────────
-keep class expo.** { *; }
-keep class host.exp.exponent.** { *; }
-keep class versioned.host.exp.exponent.** { *; }
-dontwarn expo.**

# ── Expo Modules API (used by all modern Expo modules) ────────────────────────
-keep class expo.modules.** { *; }
-keepclassmembers class expo.modules.** { *; }

# ── Expo Notifications ────────────────────────────────────────────────────────
-keep class expo.modules.notifications.** { *; }

# ── Expo SQLite ───────────────────────────────────────────────────────────────
-keep class expo.modules.sqlite.** { *; }

# ── Expo Background Fetch / Task Manager ─────────────────────────────────────
-keep class expo.modules.backgroundfetch.** { *; }
-keep class expo.modules.taskManager.** { *; }

# ── Expo Splash Screen ────────────────────────────────────────────────────────
-keep class expo.modules.splashscreen.** { *; }

# ── App package ───────────────────────────────────────────────────────────────
-keep class com.tbtechs.focusflow.** { *; }

# ── Native modules registered via @ReactModule annotation ─────────────────────
-keepclassmembers,allowobfuscation class * {
  @com.facebook.react.bridge.ReactMethod <methods>;
}
-keep @com.facebook.react.bridge.ReactModule class * { *; }
-keepclassmembers class * extends com.facebook.react.bridge.ReactContextBaseJavaModule {
  public <methods>;
}

# ── JSI / TurboModules ────────────────────────────────────────────────────────
-keep class com.facebook.react.turbomodule.** { *; }
-keep class * implements com.facebook.react.turbomodule.core.interfaces.TurboModule { *; }

# ── Serialization / Reflection safety ────────────────────────────────────────
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes SourceFile,LineNumberTable
-keepattributes Exceptions
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# ── OkHttp / Networking ───────────────────────────────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep class okio.** { *; }

# ── Kotlin ────────────────────────────────────────────────────────────────────
-keep class kotlin.** { *; }
-keep class kotlin.Metadata { *; }
-dontwarn kotlin.**
-keepclassmembers class **$WhenMappings { <fields>; }
-keepclassmembers class kotlin.Lazy { <methods>; }

# ── Coroutines ────────────────────────────────────────────────────────────────
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory { *; }
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler { *; }
-dontwarn kotlinx.coroutines.**

# ── AndroidX / Jetpack ────────────────────────────────────────────────────────
-keep class androidx.** { *; }
-dontwarn androidx.**

# ── Enum safety ───────────────────────────────────────────────────────────────
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ── Parcelable ────────────────────────────────────────────────────────────────
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# ── Serializable ─────────────────────────────────────────────────────────────
-keepnames class * implements java.io.Serializable
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ── Accessibility Service ─────────────────────────────────────────────────────
-keep class * extends android.accessibilityservice.AccessibilityService { *; }

# ── R8 full mode safety ───────────────────────────────────────────────────────
-allowaccessmodification
-repackageclasses 'o'
