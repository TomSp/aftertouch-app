import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Link href={'/settings' as never} asChild>
        <Pressable
          accessibilityLabel="Open settings"
          style={[styles.settingsButton, { top: insets.top + 18 }]}
        >
          <Text style={styles.settingsIcon}>⚙</Text>
        </Pressable>
      </Link>
      <View style={styles.container}>
        <Text style={styles.title}>Hello</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  settingsButton: {
    position: 'absolute',
    right: 18,
    zIndex: 1,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6'
  },
  settingsIcon: {
    color: '#111111',
    fontSize: 28,
    lineHeight: 32
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  title: {
    color: '#d10000',
    fontSize: 56,
    fontWeight: '700'
  }
});
