import AsyncStorage from '@react-native-async-storage/async-storage';

export const LIBRARY_STATE_KEY_PREFIX = 'aftertouch.library.state.';

export async function clearLibraryState(ipAddress: string) {
    if (!ipAddress) {
        return;
    }

    await AsyncStorage.removeItem(LIBRARY_STATE_KEY_PREFIX + ipAddress).catch(() => undefined);
}
