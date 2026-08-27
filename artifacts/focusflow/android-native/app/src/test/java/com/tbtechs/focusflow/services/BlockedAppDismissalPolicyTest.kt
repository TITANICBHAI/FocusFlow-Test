package com.tbtechs.focusflow.services

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BlockedAppDismissalPolicyTest {
    private val installers = setOf(
        "com.android.packageinstaller",
        "com.google.android.packageinstaller",
    )

    @Test
    fun normalBlockedAppGetsBackThenHomeWithRealDelays() {
        assertEquals(
            listOf(
                BlockedAppDismissalPolicy.DismissalAction(
                    BlockedAppDismissalPolicy.GlobalAction.BACK,
                    0L,
                ),
                BlockedAppDismissalPolicy.DismissalAction(
                    BlockedAppDismissalPolicy.GlobalAction.BACK,
                    30L,
                ),
                BlockedAppDismissalPolicy.DismissalAction(
                    BlockedAppDismissalPolicy.GlobalAction.HOME,
                    80L,
                ),
                BlockedAppDismissalPolicy.DismissalAction(
                    BlockedAppDismissalPolicy.GlobalAction.BACK,
                    100L,
                ),
            ),
            BlockedAppDismissalPolicy.actionsFor("com.example.distraction", installers),
        )
    }

    @Test
    fun installerGetsOnlyImmediateBackSoConfirmationIsNotHidden() {
        assertEquals(
            listOf(
                BlockedAppDismissalPolicy.DismissalAction(
                    BlockedAppDismissalPolicy.GlobalAction.BACK,
                    0L,
                ),
            ),
            BlockedAppDismissalPolicy.actionsFor(
                "COM.GOOGLE.ANDROID.PACKAGEINSTALLER",
                installers,
            ),
        )
    }

    @Test
    fun retryRequiresSameForegroundProcessAndActiveEnforcement() {
        assertTrue(
            BlockedAppDismissalPolicy.shouldRetry(
                blockedPackage = "com.example.distraction",
                lastSeenPackage = "com.example.distraction",
                focusActive = true,
                standaloneActive = false,
                alwaysOnActive = false,
                isBlocked = true,
                allowanceExhausted = false,
            ),
        )
        assertFalse(
            BlockedAppDismissalPolicy.shouldRetry(
                blockedPackage = "com.example.distraction",
                lastSeenPackage = "com.example.allowed",
                focusActive = true,
                standaloneActive = false,
                alwaysOnActive = false,
                isBlocked = true,
                allowanceExhausted = false,
            ),
        )
        assertFalse(
            BlockedAppDismissalPolicy.shouldRetry(
                blockedPackage = "com.example.distraction",
                lastSeenPackage = "com.example.distraction",
                focusActive = false,
                standaloneActive = false,
                alwaysOnActive = false,
                isBlocked = true,
                allowanceExhausted = false,
            ),
        )
    }

    @Test
    fun exhaustedAllowanceCanRetryEvenWithoutExplicitPackageBlock() {
        assertTrue(
            BlockedAppDismissalPolicy.shouldRetry(
                blockedPackage = "com.example.budgeted",
                lastSeenPackage = "com.example.budgeted",
                focusActive = false,
                standaloneActive = false,
                alwaysOnActive = true,
                isBlocked = false,
                allowanceExhausted = true,
            ),
        )
    }
}