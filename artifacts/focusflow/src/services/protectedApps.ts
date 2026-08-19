/**
 * Packages that must never be offered as app-block targets.
 *
 * Blocking these can remove the user's way home, hide core system controls,
 * prevent emergency calls, or block FocusFlow's own control surface.
 */
export const SYSTEM_NEVER_BLOCK = new Set([
  'com.android.launcher', 'com.android.launcher2', 'com.android.launcher3',
  'com.sec.android.app.launcher', 'com.google.android.apps.nexuslauncher',
  'com.miui.launcher', 'com.huawei.android.launcher', 'com.coloros.launcher',
  'com.oneplus.launcher', 'com.oppo.launcher', 'com.motorola.launcher3',
  'com.nothing.launcher', 'com.realme.launcher', 'com.iqoo.launcher',
  'com.vivo.launcher', 'com.asus.launcher', 'com.ZenUI.launcher',
  'com.lge.launcher3', 'com.htc.launcher', 'com.sonyericsson.home',
  'com.tcl.launcher', 'com.nokia.launcher', 'com.infinix.launcher',
  'com.transsion.launcher', 'com.hihonor.launcher',
  'com.android.systemui',
  'com.android.phone', 'com.android.server.telecom',
  'com.android.dialer', 'com.samsung.android.incallui', 'com.google.android.dialer',
  'com.google.android.apps.googledialer',
  'com.google.android.gms',
  'com.android.packageinstaller', 'com.google.android.packageinstaller',
  'com.samsung.android.packageinstaller',
  'com.samsung.android.wallet', 'com.samsung.android.samsungpay',
  'com.google.android.apps.walletnfcrel',
  'com.tbtechs.focusflow',
]);

export function isProtectedApp(packageName: string): boolean {
  return SYSTEM_NEVER_BLOCK.has(packageName);
}
