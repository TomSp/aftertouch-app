import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NotFoundScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={StyleSheet.flatten([styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }])}>
      <View style={styles.container}>
        <Text style={styles.title}>Not found</Text>
        <Link href="/" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>Go home</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0b0b0b'
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '700'
  },
  button: {
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
