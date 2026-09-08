import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DetailsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.container}>
        <Text style={styles.title}>Details</Text>
        <Text style={styles.body}>
          Use this screen as a starting point for your first Android feature.
        </Text>
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
    backgroundColor: '#0b0b0b'
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 16
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
    maxWidth: 360
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
