import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {vibrateBypass} from '../native/forcedVibration';

const SOURCE_PATTERN = /^(https?):\/\/([^/:\s]+|\[[^\]]+\]):(\d{1,5})$/i;
const SOURCE_STORAGE_KEY = 'aftertouch.source';
const HAPTICS_STORAGE_KEY = 'aftertouch.haptics.enabled';
const LIBRARY_ROOT_STORAGE_KEY = 'aftertouch.library.root';
const GITHUB_RELEASES_API = 'https://api.github.com/repos/TomSp/aftertouch-app/releases/latest';
const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

type PickerDevice = {name: string; ipAddress: string};

function isNewerVersion(candidate: string, current: string) {
  const candidateParts = candidate.split('.').map(Number);
  const currentParts = current.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    const candidatePart = candidateParts[index] || 0;
    const currentPart = currentParts[index] || 0;
    if (candidatePart !== currentPart) {
      return candidatePart > currentPart;
    }
  }
  return false;
}

function testHapticFeedback() {
  if (Platform.OS === 'android') {
    vibrateBypass(250);
    void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm).catch(() => undefined);
    return;
  }

  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

function isValidSource(value: string) {
  const match = value.trim().match(SOURCE_PATTERN);

  if (!match) {
    return false;
  }

  const port = Number(match[3]);
  return port >= 1 && port <= 65535;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [source, setSource] = useState('');
  const [sourceTouched, setSourceTouched] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(false);
  const [libraryRoot, setLibraryRoot] = useState('');
  const [pickerDevices, setPickerDevices] = useState<PickerDevice[]>([]);
  const [updateStatus, setUpdateStatus] = useState('');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const sourceIsValid = isValidSource(source);

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(SOURCE_STORAGE_KEY)
      .then((storedSource) => {
        if (mounted && storedSource) {
          setSource(storedSource);
        }
        return Promise.all([AsyncStorage.getItem(HAPTICS_STORAGE_KEY), AsyncStorage.getItem(LIBRARY_ROOT_STORAGE_KEY)]);
      })
      .then(([storedHaptics, storedRoot]) => {
        if (mounted) {
          setHapticsEnabled(storedHaptics === 'true');
          try { setLibraryRoot(storedRoot ? (JSON.parse(storedRoot) as {name?: string; path?: string}).name ?? '' : ''); } catch { setLibraryRoot(storedRoot ?? ''); }
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!sourceIsValid) { setPickerDevices([]); return; }
    let mounted = true;
    fetch(source.trim() + '/setup/devices')
      .then((response) => response.ok ? response.json() as Promise<unknown> : Promise.reject(new Error('Unable to load devices.')))
      .then((payload) => {
        const values = Array.isArray(payload) ? payload : payload && typeof payload === 'object' && 'devices' in payload && Array.isArray(payload.devices) ? payload.devices : [];
        const devices = values.flatMap((value) => {
          if (!value || typeof value !== 'object') return [];
          const device = value as Record<string, unknown>;
          const ip = String(device.ip_address ?? device.ip ?? device.host ?? '');
          const serial = String(device.device_serial_number ?? '');
          const name = String(device.name ?? device.device_name ?? device.deviceName ?? device.label ?? ip);
          return ip && serial ? [{name, ipAddress: ip}] : [];
        });
        if (mounted) setPickerDevices(devices);
      }).catch(() => { if (mounted) setPickerDevices([]); });
    return () => { mounted = false; };
  }, [source, sourceIsValid]);

  async function checkForUpdate() {
    setCheckingUpdate(true);
    setUpdateStatus('Checking for updates...');
    try {
      const response = await fetch(GITHUB_RELEASES_API, {headers: {Accept: 'application/vnd.github+json'}});
      if (!response.ok) throw new Error('GitHub returned status ' + response.status);
      const release = await response.json() as {tag_name?: string; html_url?: string; assets?: Array<{name?: string; browser_download_url?: string}>};
      const latestVersion = (release.tag_name ?? '').replace(/^v/i, '');
      const newer = /^\d+\.\d+\.\d+$/.test(latestVersion) && isNewerVersion(latestVersion, APP_VERSION);
      if (!newer) {
        setUpdateStatus('You are using the latest version.');
        return;
      }
      const apk = release.assets?.find((asset) => asset.name?.toLowerCase().endsWith('.apk'))?.browser_download_url;
      const updateUrl = apk || release.html_url;
      setUpdateStatus('Update available: v' + latestVersion);
      if (updateUrl) {
        Alert.alert('Update available', 'Download Aftertouch v' + latestVersion + '?', [
          {text: 'Later', style: 'cancel'},
          {text: 'Download', onPress: () => void Linking.openURL(updateUrl)}
        ]);
      }
    } catch (error) {
      setUpdateStatus(error instanceof Error ? error.message : 'Unable to check for updates.');
    } finally {
      setCheckingUpdate(false);
    }
  }

  return (
    <View style={StyleSheet.flatten([styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }])}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>Settings</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Aftertouch source</Text>
          <TextInput
            accessibilityLabel="Aftertouch source"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onBlur={() => {
              setSourceTouched(true);
              if (isValidSource(source)) {
                void AsyncStorage.setItem(SOURCE_STORAGE_KEY, source.trim());
              }
            }}
            onChangeText={setSource}
            placeholder="protocol://host:port"
            placeholderTextColor="#9ca3af"
            style={StyleSheet.flatten([styles.input, sourceTouched && !sourceIsValid && styles.inputError])}
            value={source}
          />
          {sourceTouched && !sourceIsValid ? (
            <Text style={styles.error}>Use a valid HTTP source such as http://localhost:8080 or https://device.local:443.</Text>
          ) : null}
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Library root</Text>
          <Text accessibilityLabel="Selected Library root" style={styles.selectedValue}>{libraryRoot || 'Media server list'}</Text>
          <Text style={styles.description}>Choose a device in Library root selection, then long press a folder to set it as the root.</Text>
          {pickerDevices.map((device) => (
            <Link href={('/library?ip_address=' + encodeURIComponent(device.ipAddress) + '&name=' + encodeURIComponent(device.name) + '&select_root=true') as never} key={device.ipAddress} asChild>
              <Pressable accessibilityLabel={'Choose Library root on ' + device.name} style={styles.button}>
                <Text style={styles.buttonText}>{'Choose on ' + device.name}</Text>
              </Pressable>
            </Link>
          ))}
        </View>
        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <Text style={styles.label}>Haptic feedback</Text>
            <Text style={styles.description}>Vibrate briefly when a device control is pressed.</Text>
          </View>
          <Switch
            accessibilityLabel="Haptic feedback"
            onValueChange={(enabled) => {
              setHapticsEnabled(enabled);
              void AsyncStorage.setItem(HAPTICS_STORAGE_KEY, String(enabled));
            }}
            thumbColor="#ffffff"
            trackColor={{false: '#4b5563', true: '#f87171'}}
            value={hapticsEnabled}
          />
        </View>
        <Pressable accessibilityLabel="Check for updates" disabled={checkingUpdate} onPress={() => void checkForUpdate()} style={styles.button}>
          <Text style={styles.buttonText}>{checkingUpdate ? 'Checking...' : 'Check for updates'}</Text>
        </Pressable>
        {updateStatus ? <Text accessibilityLabel="Update status" style={styles.description}>{updateStatus}</Text> : null}
        <Pressable accessibilityLabel="Test vibration" onPress={testHapticFeedback} style={styles.button}>
          <Text style={styles.buttonText}>Test vibration</Text>
        </Pressable>
        <Link href="/" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>Back home</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#111111'
  },
  container: {
    flex: 1,
    padding: 24,
    gap: 18
  },
  eyebrow: {
    color: '#f87171',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  field: {
    gap: 8
  },
  settingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16
  },
  settingCopy: {
    flex: 1,
    gap: 4
  },
  description: {
    color: '#9ca3af',
    fontSize: 14
  },
  label: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  input: {
    borderColor: '#4b5563',
    borderRadius: 10,
    borderWidth: 1,
    color: '#ffffff',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  inputError: {
    borderColor: '#f87171'
  },
  error: {
    color: '#f87171',
    fontSize: 14
  },
  selectedValue: {color: '#ffffff', fontSize: 16, fontWeight: '600'},
  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  buttonText: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '600'
  }
});
