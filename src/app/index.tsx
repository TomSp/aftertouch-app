import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import {Link} from 'expo-router';
import {useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

const SOURCE_STORAGE_KEY = 'aftertouch.source';
const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
type Device = Record<string, unknown>;

function isDiscoveredDevice(device: unknown): device is Device {
    if (!device || typeof device !== 'object') {
        return false;
    }

    const serialNumber = (device as Device).device_serial_number;
    return typeof serialNumber === 'string' && serialNumber.trim().length > 0;
}

function getDevices(payload: unknown): Device[] {
    if (Array.isArray(payload)) {
        return payload.filter(isDiscoveredDevice);
    }

    if (payload && typeof payload === 'object' && 'devices' in payload && Array.isArray(payload.devices)) {
        return payload.devices.filter(isDiscoveredDevice);
    }

    return [];
}

function deviceValue(device: Device, keys: string[]) {
    for (const key of keys) {
        const value = device[key];
        if (typeof value === 'string' || typeof value === 'number') {
            return String(value);
        }
    }

    return null;
}

export default function HomeScreen() {
    const insets = useSafeAreaInsets();
    const [devices, setDevices] = useState<Device[]>([]);
    const [sourceConfigured, setSourceConfigured] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        async function loadDevices() {
            const storedSource = (await AsyncStorage.getItem(SOURCE_STORAGE_KEY))?.trim() ?? '';

            if (!mounted) {
                return;
            }

            setSourceConfigured(Boolean(storedSource));
            if (!storedSource) {
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const devicesUri = storedSource + '/setup/devices';
                console.info('[Aftertouch] Fetching devices from ' + devicesUri);
                const response = await fetch(devicesUri);
                if (!response.ok) {
                    setError('Request failed with status ' + response.status);
                    setDevices([]);
                } else {

                    const payload: unknown = await response.json();
                    console.info('[Aftertouch] Devices response from ' + devicesUri + ' returned HTTP ' + response.status);
                    if (mounted) {
                        setDevices(getDevices(payload));
                    }
                }
            } catch (requestError) {
                if (mounted) {
                    setError(requestError instanceof Error ? requestError.message : 'Unable to load devices.');
                    setDevices([]);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        void loadDevices().catch(() => {
            if (mounted) {
                setError('Unable to load devices.');
                setLoading(false);
            }
        });

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <View style={StyleSheet.flatten([styles.safe, {paddingTop: insets.top, paddingBottom: insets.bottom}])}>
            <Link href={'/settings' as never} asChild>
                <Pressable
                    accessibilityLabel="Open settings"
                    style={StyleSheet.flatten([styles.settingsButton, {top: insets.top + 18}])}
                >
                    <Text style={styles.settingsIcon}>⚙</Text>
                </Pressable>
            </Link>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>Aftertouch</Text>
                {!sourceConfigured ?
                    <Text style={styles.message}>Configure an Aftertouch source in Settings.</Text> : null}
                {loading ? <Text style={styles.message}>Loading devices...</Text> : null}
                {error ? <Text style={styles.error}>Unable to load devices: {error}</Text> : null}
                {sourceConfigured && !loading && !error && devices.length === 0 ? (
                    <Text style={styles.message}>No known devices.</Text>
                ) : null}
                {devices.map((device, index) => {
                    const name = deviceValue(device, ['name', 'device_name', 'deviceName', 'label']) ?? 'Device ' + (index + 1);
                    const address = deviceValue(device, ['ip_address', 'ip_adresse', 'ip', 'host', 'address', 'mac']);
                    const id = deviceValue(device, ['id', 'deviceId', 'serialNumber']);

                    return (
                        <Link
                            key={id ?? 'device-' + index}
                            href={('/device?ip_address=' + encodeURIComponent(address ?? '') + '&name=' + encodeURIComponent(name)) as never}
                            asChild
                        >
                            <Pressable style={styles.deviceCard} accessibilityLabel={'Open ' + name}>
                                <Text style={styles.deviceName}>{name}</Text>
                                {address ? <Text style={styles.deviceDetail}>{address}</Text> : null}
                                {id && id !== address ? <Text style={styles.deviceDetail}>{id}</Text> : null}
                            </Pressable>
                        </Link>
                    );
                })}
            </ScrollView>
            <Text style={StyleSheet.flatten([styles.version, {bottom: insets.bottom + 12}])}>v{APP_VERSION}</Text>
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
        flexGrow: 1,
        alignItems: 'center',
        padding: 24,
        paddingTop: 88,
        gap: 16
    },
    title: {
        color: '#d10000',
        fontSize: 56,
        fontWeight: '700'
    },
    message: {
        color: '#4b5563',
        fontSize: 16,
        textAlign: 'center'
    },
    error: {
        color: '#b91c1c',
        fontSize: 16,
        textAlign: 'center'
    },
    deviceCard: {
        alignSelf: 'stretch',
        borderColor: '#d1d5db',
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        gap: 4
    },
    deviceName: {
        color: '#111827',
        fontSize: 18,
        fontWeight: '700'
    },
    deviceDetail: {
        color: '#4b5563',
        fontSize: 15
    },
    version: {
        position: 'absolute',
        right: 12,
        color: '#9ca3af',
        fontSize: 12
    }
});
