package com.focusflow

val IS_WINDOWS = System.getProperty("os.name")
    .lowercase().contains("windows")
val IS_LINUX = System.getProperty("os.name")
    .lowercase().contains("linux")
val IS_MAC = System.getProperty("os.name")
    .lowercase().contains("mac")