# Contract Mismatch Fixes - Todo List

## Critical Fixes
- [x] **Native: Emit FOCUS_STARTED event** - Added broadcast in FocusDayBridgeModule.kt when focus starts
- [x] **Native: Emit FOCUS_ENDED event** - Added broadcast in FocusDayBridgeModule.kt when focus ends  
- [x] **Native: Emit FOCUS_VIOLATION event** - Added broadcast in FocusDayBridgeModule.kt + AppBlockerAccessibilityService.kt when violation detected

## High Priority
- [x] **Remove /healthz API spec** - Deleted openapi.yaml healthz endpoint
- [x] **Remove healthCheck client code** - Deleted generated api.ts healthCheck functions
- [x] **Remove api.schemas.ts HealthStatus** - Cleaned up generated schemas
- [x] **Remove orval.config.ts** - Deleted orval config

## Medium Priority
- [x] **Align launcherLockDuringStandalone default** - Updated JS SharedPrefsModule.ts to default to true (matching native)

## Low Priority
- [x] **Remove dead event types from NativeEventType** - Removed TASK_TICK, FOCUS_START, FOCUS_STOP, SERVICE_RESTART, BOOT_COMPLETED, PERMISSION_RESULT, BATTERY_LOW from eventBridge.ts
- [x] **Fix duplicate DEFENSE_PIN_HASH** - Removed duplicate key in SharedPrefsModule.ts SP_KEYS