import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>Settings</Text>
        <Text style={styles.title}>Device discovery</Text>
        <Text style={styles.body}>
          Detect Bose SoundTouch devices through the local AfterTouch service.
        </Text>
        <View style={styles.card}>
          <Text style={styles.label}>Discovery API</Text>
          <Text style={styles.value}>POST /setup/discover</Text>
          <Text style={styles.value}>GET /setup/devices</Text>
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
    justifyContent: 'center',
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
  title: {
    color: '#ffffff',
    fontSize: 40,
    fontWeight: '700'
  },
  body: {
    color: '#d1d5db',
    fontSize: 18,
    lineHeight: 26,
    maxWidth: 380
  },
  card: {
    gap: 8,
    borderRadius: 20,
    backgroundColor: '#1f2937',
    padding: 18
  },
  label: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  value: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600'
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
