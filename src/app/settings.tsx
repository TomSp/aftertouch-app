import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SOURCE_PATTERN = /^(https?):\/\/([^/:\s]+|\[[^\]]+\]):(\d{1,5})$/i;
const SOURCE_STORAGE_KEY = 'aftertouch.source';
const HAPTICS_STORAGE_KEY = 'aftertouch.haptics.enabled';

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
  const sourceIsValid = isValidSource(source);

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(SOURCE_STORAGE_KEY)
      .then((storedSource) => {
        if (mounted && storedSource) {
          setSource(storedSource);
        }
        return AsyncStorage.getItem(HAPTICS_STORAGE_KEY);
      })
      .then((storedHaptics) => {
        if (mounted) {
          setHapticsEnabled(storedHaptics === 'true');
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

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
