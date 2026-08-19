# FocusFlow — Full Button Audit

Every `TouchableOpacity`, `Pressable`, and tappable element across all screens and components.
Status: ✅ Wired & working | ⚠️ Needs attention

---

## Screens (`app/`)

### Schedule (`index.tsx`)
| Button | Action | Status |
|--------|--------|--------|
| Active task banner | Opens task detail modal | ✅ |
| Banner — Complete (✓) | `completeTask(bannerTask.id)` | ✅ |
| Banner — Extend (+) | Opens extend modal | ✅ |
| Banner — Skip (✕) | Alert confirmation → `skipTask(id)` | ✅ |
| Banner — Start Focus (shield) | `startFocusMode(bannerTask.id)` | ✅ |
| Task card (list row) | Opens task detail modal | ✅ |
| FAB (+) | Opens quick-add modal | ✅ |

### Focus (`focus.tsx`)
| Button | Action | Status |
|--------|--------|--------|
| Add More Apps (standalone active state) | Opens block modal | ✅ |
| +30m / +1h / +2h / +4h time buttons | `handleAddTime(minutes)` | ✅ |
| Create a Task (empty state) | `router.push('/')` | ✅ |
| Always-On App List row | `router.push('/always-on')` | ✅ |
| VPN Block List row | `router.push('/vpn-block-list')` | ✅ |
| Daily Allowance row | Opens daily allowance modal | ✅ |
| Block Schedules row | `router.push('/block-defense?tab=greyout')` | ✅ |
| Keyword Blocker row | `router.push('/keyword-blocker')` | ✅ |
| Always-On enforcement toggle (Switch) | `handleToggleEnforcement(next)` | ✅ |
| Clear always-on list | Alert confirmation → `updateSettings(...)` | ✅ |
| Quick-block preset duration buttons (1h/2h/4h/8h) | `handleQuickBlock(preset, hours)` | ✅ |
| Block Apps Without a Task | Opens block modal | ✅ |
| See live status → Active page | `router.push('/active')` | ✅ |
| Main focus ring (Start Focus) | `handleActivateFocus(task.id)` | ✅ |
| Complete task (tick icon, active state) | `completeTask(task.id)` | ✅ |
| Skip task (skip icon, active state) | `skipTask(task.id)` | ✅ |
| Extend task (timer icon, active state) | Opens extend modal | ✅ |
| Stop Focus button | PIN check → `stopFocusMode()` | ✅ |
| Accessibility permission banner | Opens Android accessibility settings | ✅ |

### Stats (`stats.tsx`)
| Button | Action | Status |
|--------|--------|--------|
| Filter pills (Today / Yesterday / Week / Month / All) | `setFilter(f)` | ✅ |
| Clear Log (All Time tab) | Alert confirmation → clears DB log | ✅ |

### Settings (`settings.tsx`)
| Button | Action | Status |
|--------|--------|--------|
| Profile row | `router.push('/user-profile')` | ✅ |
| Request Notifications | `handleRequestNotifications()` | ✅ |
| Duration chips (15 / 30 / 45 / 60 min) | `update({ defaultDuration: d })` | ✅ |
| Manage Allowed Apps | Opens allowed-apps modal | ✅ |
| Manage Daily Allowance | Opens daily allowance modal | ✅ |
| Manage Blocked Keywords | Opens blocked-words modal | ✅ |
| Manage PIN Passwords | `router.push('/block-defense')` | ✅ |
| Manage Block Schedules | Opens greyout schedule modal | ✅ |
| Manage Standalone Block | Opens block modal | ✅ |
| Block Protection Status banner | `router.push('/active')` | ✅ |
| Import from Other App | Opens import modal | ✅ |
| Export Backup | `handleExportBackup()` | ✅ |
| Import Backup | `handleImportBackup()` | ✅ |
| Clear All Tasks | Alert confirmation → deletes all tasks | ✅ |
| Overlay Appearance | Opens overlay appearance modal | ✅ |
| Diagnostics (dev only) | Opens diagnostics modal | ✅ |
| Privacy Policy | `router.push('/privacy-policy')` | ✅ |
| Terms of Service | `router.push('/terms-of-service')` | ✅ |
| Changelog | `router.push('/changelog')` | ✅ |

### Active (`active.tsx`)
| Button | Action | Status |
|--------|--------|--------|
| Back (‹) | `router.back()` | ✅ |
| Stop Focus | PIN check → `stopFocusMode()` | ✅ |
| Add Time / More Apps | `router.push('/(tabs)/focus')` | ✅ |
| Overlay List | `router.push('/always-on')` | ✅ |
| VPN List | `router.push('/vpn-block-list')` | ✅ |
| Clear Standalone Block | Alert confirmation → `setStandaloneBlockAndAllowance([],...)` | ✅ |
| Set Up VPN Block List (empty state) | `router.push('/vpn-block-list')` | ✅ |
| Manage Schedules | `router.push('/block-defense?tab=greyout')` | ✅ |
| Enforcement layer rows (System Guard / Shorts / Reels / Keywords) | `router.push(layer.route)` | ✅ |
| Quick Action — Start Standalone | `router.push('/(tabs)/focus')` | ✅ |
| Quick Action — Edit Schedules | `router.push('/block-defense?tab=greyout')` | ✅ |
| Quick Action — Block Enforcement | `router.push('/block-defense')` | ✅ |
| Quick Action — Open Stats | `router.push('/(tabs)/stats')` | ✅ |

### Always-On (`always-on.tsx`)
| Button | Action | Status |
|--------|--------|--------|
| Back (‹) | `router.back()` | ✅ |
| Clear all | `handleClearAll()` | ✅ |
| App row toggle | `toggle(packageName)` | ✅ |
| VPN row toggle | `toggleVpn(packageName)` | ✅ |
| Clear search (✕) | `setSearch('')` | ✅ |
| Save | `handleSave()` | ✅ |

### Block Defense (`block-defense.tsx`)
| Button | Action | Status |
|--------|--------|--------|
| Back (‹) | `router.back()` | ✅ |
| Nuclear Mode | Opens nuclear mode modal | ✅ |
| Status hint banner | `router.push('/active')` | ✅ |
| Focus Session PIN — Set / Change / Remove | `setPinModal(...)` | ✅ |
| Defense PIN — Set / Change / Remove | `setPinModal(...)` | ✅ |
| Manage Word List | `router.push('/keyword-blocker')` | ✅ |
| Manage Block Schedules | Opens greyout schedule modal | ✅ |

### VPN Block List (`vpn-block-list.tsx`)
| Button | Action | Status |
|--------|--------|--------|
| Back (‹) | `router.back()` | ✅ |
| Clear all | `handleClearAll()` | ✅ |
| App row toggle | `toggle(packageName)` | ✅ |
| Clear search (✕) | `setSearch('')` | ✅ |
| Save | `handleSave()` | ✅ |

### Keyword Blocker (`keyword-blocker.tsx`)
| Button | Action | Status |
|--------|--------|--------|
| Back (‹) | `router.back()` | ✅ |
| Add / Manage Keywords | Opens modal | ✅ |
| Clear All Keywords | `handleClearAll()` | ✅ |
| Preset cards | `handleAddPreset(preset)` | ✅ |

### Onboarding (`onboarding.tsx`)
| Button | Action | Status |
|--------|--------|--------|
| Permission card (expand/collapse) | `setExpandedId(...)` | ✅ |
| Grant permission button | `handleGrant(perm)` | ✅ |
| Troubleshoot | `Linking.openSettings()` | ✅ |
| Get Started / Finish | Saves settings → `router.replace('/user-profile')` | ✅ |

### Permissions (`permissions.tsx`)
| Button | Action | Status |
|--------|--------|--------|
| Back (‹) | `router.back()` | ✅ |
| Refresh (↺) | `checkAll()` | ✅ |
| Go Back (locked state) | `router.back()` | ✅ |
| Permission card (expand/collapse) | `setExpandedId(...)` | ✅ |
| Deep-link open-settings button | `perm.open()` | ✅ |
| Troubleshoot | `setTroubleshootPerm(perm.id)` | ✅ |
| Configure Launcher | `router.push('/home-launcher')` | ✅ |

### User Profile (`user-profile.tsx`)
| Button | Action | Status |
|--------|--------|--------|
| Back (‹) | `router.back()` | ✅ |
| Skip | `handleSkip()` | ✅ |
| Edit pencil | `setIsEditing(true)` | ✅ |
| Import Backup banner | `handleImportFromBackup()` | ✅ |
| Occupation chips | `setOccupation(value)` | ✅ |
| Goal chips | `toggleGoal(value)` | ✅ |
| Goal hours stepper (−/+) | `setGoalHours(...)` | ✅ |
| Wake time options | `setWakeTime(value)` | ✅ |
| Chronotype options | `setChronotype(value)` | ✅ |
| Save | `handleSave()` → routes to `/how-to-use` or `back` | ✅ |

### Reports (`reports.tsx`)
| Button | Action | Status |
|--------|--------|--------|
| Back (‹) | `router.back()` or `router.replace('/')` | ✅ |
| Date range pills | `setRange(r)` | ✅ |
| Plan Today | `router.replace('/(tabs)')` | ✅ |

### Home Launcher (`home-launcher.tsx`)
| Button | Action | Status |
|--------|--------|--------|
| Back (‹) | `router.back()` | ✅ |
| Go Back (locked state) | `router.back()` | ✅ |
| Set as Default | `handleSetDefault()` | ✅ |
| Clock style segments | `update({ launcherClockStyle: style })` | ✅ |
| Wallpaper row | `Alert.alert(...)` info dialog | ✅ |
| Dock app toggle rows | `toggleDock(pkg)` | ✅ |
| Pinned app toggle rows | `togglePinned(pkg)` | ✅ |
| Hidden app toggle rows | `toggleHidden(pkg)` | ✅ |

### How-to-Use (`how-to-use.tsx`)
| Button | Action | Status |
|--------|--------|--------|
| Back (‹) | `router.back()` | ✅ |
| Skip (onboarding flow) | `router.replace('/')` | ✅ |
| Guide card (expand/collapse) | `toggle(i)` | ✅ |
| Get Started | `router.replace('/')` | ✅ |

### Changelog (`changelog.tsx`)
| Button | Action | Status |
|--------|--------|--------|
| Back (‹) | `router.back()` | ✅ |

### Tab Bar & Layout
| Button | Action | Status |
|--------|--------|--------|
| Schedule tab | Navigate to `index.tsx` | ✅ |
| Focus tab | Navigate to `focus.tsx` | ✅ |
| Stats tab | Navigate to `stats.tsx` | ✅ |
| Settings tab | Navigate to `settings.tsx` | ✅ |
| Side menu toggle | `openMenu()` / `closeMenu()` | ✅ |
| Dark mode toggle | `DarkModeToggle` component | ✅ |

---

## Components (`src/components/`)

### TaskCard.tsx
| Button | Action | Status |
|--------|--------|--------|
| Complete toggle (circle/check icon) | `onComplete(task.id)` prop | ✅ |
| Extend (timer icon) | `onExtend(task.id)` prop | ✅ |
| Start Focus / Skip | `onStartFocus(id)` / `onSkip(id)` props | ✅ |

### TaskDetailModal.tsx
| Button | Action | Status |
|--------|--------|--------|
| Close (✕) | `onClose` prop | ✅ |
| Edit (pencil) | `onEdit(task)` prop | ✅ |
| Complete | `onComplete(task.id)` prop | ✅ |
| Skip | `onSkip(task.id)` prop | ✅ |
| Extend | `onExtend(task.id)` prop | ✅ |
| Start Focus | `onStartFocus(task.id)` prop | ✅ |

### EditTaskModal.tsx
| Button | Action | Status |
|--------|--------|--------|
| Cancel | `onClose` prop | ✅ |
| Date/time pickers | Opens native picker | ✅ |
| Save | `handleSave()` → `onSave(task)` prop | ✅ |
| Delete Task | Alert confirmation → `onDelete(id)` prop | ✅ |

### QuickAddModal.tsx
| Button | Action | Status |
|--------|--------|--------|
| Close (✕) | `onClose` prop | ✅ |
| Add / Send | `handleAdd()` → `onSave(task)` prop | ✅ |

### ExtendModal.tsx
| Button | Action | Status |
|--------|--------|--------|
| Time preset chips (+5 / +15 / +30 / +60 min) | Updates local state | ✅ |
| Confirm / Extend | `onExtend(id, minutes)` prop | ✅ |

### StandaloneBlockModal.tsx
| Button | Action | Status |
|--------|--------|--------|
| Close (✕) | `onClose` prop | ✅ |
| App selection row | Opens `AppPickerSheet` | ✅ |
| Schedule day / time rows | Opens sub-scheduling UI | ✅ |

### PinSetupModal.tsx / PinVerifyModal.tsx / PinRotationModal.tsx
| Button | Action | Status |
|--------|--------|--------|
| Number pad (0–9) | Updates internal pin state | ✅ |
| Backspace | Removes last digit | ✅ |
| Submit / Verify | `onComplete(pin)` or `onVerified()` prop | ✅ |
| Cancel | `onCancel` prop | ✅ |

### NuclearModeModal.tsx
| Button | Action | Status |
|--------|--------|--------|
| Duration preset chips (1h / 4h / 8h / 24h) | Sets internal duration | ✅ |
| Activate Nuclear Mode | `onActivate(settings)` prop | ✅ |
| Cancel / Close | `onClose` prop | ✅ |

### SideMenu.tsx
| Button | Action | Status |
|--------|--------|--------|
| Nav items (Active, Block Defense, Reports, etc.) | `navigate(screen)` + `onClose()` | ✅ |

### AppPickerSheet.tsx
| Button | Action | Status |
|--------|--------|--------|
| App row toggle | `onToggleApp(pkgName)` prop | ✅ |
| Done | `onClose()` prop | ✅ |

### OverlayAppearanceModal.tsx
| Button | Action | Status |
|--------|--------|--------|
| Close (✕) | `onClose` prop | ✅ |
| Remove Wallpaper (trash) | `handleRemoveWallpaper()` | ✅ |
| Pick / Change Image | `handlePickImage()` → `NativeImagePickerModule` | ✅ |
| Add Quote (+) | `handleAddQuote()` | ✅ |
| Remove quote (✕) | `handleRemoveQuote(i)` | ✅ |

### ImportFromOtherAppModal.tsx
| Button | Action | Status |
|--------|--------|--------|
| Back (step nav) | `setStep('sources')` | ✅ |
| Cancel | `handleClose()` → `onClose` prop | ✅ |
| Browse & Import | `handleBrowse()` → `NativeFilePickerModule` | ✅ |
| Paste Names entry | `setStep('paste')` | ✅ |
| Match Names | `handleMatchNames()` fuzzy match | ✅ |
| Try Different Names (retry) | `setStep('sources')` | ✅ |
| Add X Apps (confirm import) | `handleConfirmImport()` → `onImport` prop | ✅ |

### TroubleshootModal.tsx
| Button | Action | Status |
|--------|--------|--------|
| Inner sheet press | `onPress={() => {}}` — intentional event blocker | ✅ |
| Close / action buttons | `onClose` prop | ✅ |

---

## Summary

| Scope | Total Buttons | Issues Found |
|-------|--------------|--------------|
| App screens | ~120 | 0 |
| Components / modals | ~55 | 0 |
| **Total** | **~175** | **0** |

Every button is correctly wired. All navigation routes exist. All context functions are real. No dead handlers.
