import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

const { NativeImagePicker } = NativeModules as {
  NativeImagePicker: {
    pickImage(): Promise<string | null>;
    checkMediaPermission(): Promise<boolean>;
  };
};

export const NativeImagePickerModule = {
  /**
   * Opens the system photo picker and returns the selected image URI,
   * or null if the user cancelled.  Android only.
   */
  async pickImage(): Promise<string | null> {
    if (Platform.OS !== 'android') return null;
    if (!NativeImagePicker?.pickImage) return null;
    return NativeImagePicker.pickImage();
  },

  /**
   * Returns true if the app can read media without a runtime permission dialog.
   * Always true on Android 13+ (Photo Picker is permission-free).
   */
  async checkMediaPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    if (!NativeImagePicker?.checkMediaPermission) return false;
    return NativeImagePicker.checkMediaPermission();
  },

  /**
   * Requests READ_EXTERNAL_STORAGE on Android 8–12.
   * On Android 13+ returns true immediately (Photo Picker needs no permission).
   */
  async requestMediaPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    if ((Platform.Version as number) >= 33) return true;
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      {
        title: 'Media Access',
        message:
          'FocusFlow needs access to your photos to set a custom overlay wallpaper.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  },
};
