import {NativeModules, Platform, Vibration} from 'react-native';

type ForcedVibrationModule = {
    vibrate: (durationMs: number) => void;
};

const forcedVibration = NativeModules.ForcedVibration as ForcedVibrationModule | undefined;

export function vibrateBypass(durationMs: number) {
    if (Platform.OS === 'android' && forcedVibration?.vibrate) {
        forcedVibration.vibrate(durationMs);
        return;
    }

    Vibration.vibrate(durationMs);
}
