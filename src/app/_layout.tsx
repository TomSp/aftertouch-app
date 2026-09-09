import {Link, Stack} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {Image, Pressable, StyleSheet} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <StatusBar style="light"/>
            <Stack
                screenOptions={{
                    headerStyle: {backgroundColor: '#111111'},
                    headerTintColor: '#f5f5f5',
                    headerLeft: () => (
                        <Link href="/" asChild>
                            <Pressable accessibilityLabel="Go home" style={styles.headerHomeButton}>
                                <Image
                                    accessibilityIgnoresInvertColors
                                    source={require('../../assets/icon.png')}
                                    style={styles.headerIcon}
                                />
                            </Pressable>
                        </Link>
                    ),
                    contentStyle: {backgroundColor: '#0b0b0b'}
                }}>
                <Stack.Screen name="index" options={{title: 'Home'}}/>
                <Stack.Screen name="settings" options={{title: 'Settings'}}/>
            </Stack>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    headerHomeButton: {
        marginRight: 12
    },
    headerIcon: {
        width: 28,
        height: 28,
        borderRadius: 6
    }
});
