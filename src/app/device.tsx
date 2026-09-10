import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Slider from '@react-native-community/slider';
import {VolumeManager} from 'react-native-volume-manager';
import {Stack, useLocalSearchParams} from 'expo-router';
import {useEffect, useRef, useState} from 'react';
import {Image, Platform, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {vibrateBypass} from '../native/forcedVibration';

type DeviceStatus = {
    source: string;
    playStatus: string;
    track: string;
    artist: string;
};

type VolumeStatus = {
    target: number;
    actual: number;
    muted: boolean;
};

type Preset = {
    id: string;
    name: string;
    containerArt: string;
};

const HAPTICS_STORAGE_KEY = 'aftertouch.haptics.enabled';

function parameter(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function xmlTag(xml: string, tag: string) {
    const match = xml.match(new RegExp('<' + tag + '[^>]*>([^<]*)</' + tag + '>'));
    return match?.[1]?.trim() ?? '';
}

function xmlAttribute(xml: string, tag: string, attribute: string) {
    const match = xml.match(new RegExp('<' + tag + '\\b[^>]*\\b' + attribute + '="([^"]*)"'));
    return match?.[1] ?? '';
}

function parsePresets(xml: string): Preset[] {
    const presets: Preset[] = [];
    const presetPattern = /<preset\b[^>]*\bid="([^"]+)"[\s\S]*?<itemName>([^<]*)<\/itemName>[\s\S]*?<\/preset>/g;
    let match = presetPattern.exec(xml);

    while (match) {
        presets.push({
            id: match[1],
            name: match[2].trim() || 'Unnamed preset',
            containerArt: xmlTag(match[0], 'containerArt')
        });
        match = presetPattern.exec(xml);
    }

    return presets;
}

async function requestText(uri: string, options?: RequestInit) {
    const response = await fetch(uri, options);
    if (!response.ok) {
        throw new Error('Request failed with status ' + response.status);
    }
    return response.text();
}

function wait(milliseconds: number) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export default function DeviceScreen() {
    const insets = useSafeAreaInsets();
    const {ip_address, name} = useLocalSearchParams<{ip_address?: string | string[]; name?: string | string[]}>();
    const ipAddress = parameter(ip_address);
    const deviceName = parameter(name) || ipAddress || 'Device';
    const baseUri = 'http://' + ipAddress + ':8090';
    const [status, setStatus] = useState<DeviceStatus | null>(null);
    const [volume, setVolume] = useState<VolumeStatus | null>(null);
    const [presets, setPresets] = useState<Preset[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hapticsEnabled, setHapticsEnabled] = useState(false);
    const volumeRef = useRef<VolumeStatus | null>(null);
    const nativeVolumeRef = useRef<number | null>(null);

    async function loadStatus() {
        if (!ipAddress) {
            setError('No device IP address was provided.');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const [nowPlayingXml, volumeXml, presetsXml] = await Promise.all([
                requestText(baseUri + '/now_playing'),
                requestText(baseUri + '/volume'),
                requestText(baseUri + '/presets')
            ]);
            console.info('[Aftertouch] Device status response from ' + baseUri);
            setStatus({
                source: xmlAttribute(nowPlayingXml, 'nowPlaying', 'source') || 'Unknown',
                playStatus: xmlAttribute(nowPlayingXml, 'nowPlaying', 'playStatus') || 'Unknown',
                track: xmlTag(nowPlayingXml, 'track') || xmlTag(nowPlayingXml, 'trackTitle') || 'Not playing',
                artist: xmlTag(nowPlayingXml, 'artist') || xmlTag(nowPlayingXml, 'artistName') || ''
            });
            const nextVolume = {
                target: Number(xmlTag(volumeXml, 'targetvolume')) || 0,
                actual: Number(xmlTag(volumeXml, 'actualvolume')) || 0,
                muted: xmlTag(volumeXml, 'muteenabled').toLowerCase() === 'true'
            };
            volumeRef.current = nextVolume;
            setVolume(nextVolume);
            setPresets(parsePresets(presetsXml));
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Unable to load device status.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        AsyncStorage.getItem(HAPTICS_STORAGE_KEY).then((storedHaptics) => {
            setHapticsEnabled(storedHaptics === 'true');
        }).catch(() => undefined);

        void loadStatus();
        const refreshTimer = setInterval(() => {
            void loadStatus();
        }, 15000);

        return () => clearInterval(refreshTimer);
    }, [ipAddress]);

    useEffect(() => {
        void VolumeManager.showNativeVolumeUI({enabled: false});
        const volumeListener = VolumeManager.addVolumeListener((result) => {
            if (result.type && result.type !== 'music') {
                return;
            }

            const previousVolume = nativeVolumeRef.current;
            nativeVolumeRef.current = result.volume;
            if (previousVolume === null || previousVolume === result.volume) {
                return;
            }

            const currentTarget = volumeRef.current?.target ?? 0;
            const delta = result.volume > previousVolume ? 1 : -1;
            void setVolumeValue(Math.max(0, Math.min(100, currentTarget + delta)));
        });

        return () => {
            volumeListener.remove();
            void VolumeManager.showNativeVolumeUI({enabled: true});
        };
    }, []);

    function triggerHapticFeedback() {
        if (Platform.OS === 'android') {
            vibrateBypass(120);
            void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key).catch(() => undefined);
            return;
        }

        void Haptics.selectionAsync().catch(() => undefined);
    }

    function provideHapticFeedback() {
        void AsyncStorage.getItem(HAPTICS_STORAGE_KEY).then((storedHaptics) => {
            const enabled = storedHaptics === 'true';
            setHapticsEnabled(enabled);
            if (enabled) {
                triggerHapticFeedback();
            }
        }).catch(() => {
            if (hapticsEnabled) {
                triggerHapticFeedback();
            }
        });
    }

    async function sendKey(key: string) {
        provideHapticFeedback();
        setBusy(true);
        setError(null);
        try {
            const body = (state: string) => '<key state="' + state + '" sender="Gabbo">' + key + '</key>';
            await requestText(baseUri + '/key', {method: 'POST', headers: {'Content-Type': 'application/xml'}, body: body('press')});
            await requestText(baseUri + '/key', {method: 'POST', headers: {'Content-Type': 'application/xml'}, body: body('release')});
            await wait(2000);
            await loadStatus();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Unable to control device.');
        } finally {
            setBusy(false);
        }
    }

    async function setVolumeValue(nextVolume: number, reloadStatus = false) {
        provideHapticFeedback();
        setVolume((current) => {
            const next = current ? {...current, target: nextVolume} : current;
            volumeRef.current = next;
            return next;
        });
        setBusy(true);
        setError(null);
        try {
            await requestText(baseUri + '/volume', {
                method: 'POST',
                headers: {'Content-Type': 'application/xml'},
                body: '<volume>' + nextVolume + '</volume>'
            });
            if (reloadStatus) {
                await wait(2000);
                await loadStatus();
            }
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Unable to change volume.');
        } finally {
            setBusy(false);
        }
    }

    async function changeVolume(delta: number) {
        if (!volume) {
            return;
        }

        await setVolumeValue(Math.max(0, Math.min(100, volume.target + delta)), true);
    }

    return (
        <>
            <Stack.Screen options={{title: deviceName}}/>
            <View style={StyleSheet.flatten([styles.safe, {paddingTop: insets.top, paddingBottom: insets.bottom}])}>
            <ScrollView contentContainerStyle={styles.container}>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                {status ? <View style={styles.card}>
                    <View style={styles.statusHeader}>
                        <Text style={styles.sectionTitle}>Status</Text>
                        <Text style={styles.address}>{ipAddress}:8090</Text>
                    </View>
                    <Text style={styles.value}>Source: {status.source}</Text>
                    <View style={styles.statusTrackRow}>
                        <Text style={styles.trackValue}>Track: {status.track}</Text>
                        <Pressable
                            accessibilityLabel="Refresh status"
                            disabled={busy}
                            onPress={() => void loadStatus()}
                            style={styles.refreshButton}
                        >
                            <Text style={styles.refreshText}>↻</Text>
                        </Pressable>
                    </View>
                    {status.artist ? <Text style={styles.value}>Artist: {status.artist}</Text> : null}
                </View> : null}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Presets</Text>
                    {presets.length > 0 ? <View style={styles.presetGrid}>
                        {presets.map((preset) => (
                            <Pressable
                                key={preset.id}
                                accessibilityLabel={'Preset ' + preset.id + ': ' + preset.name}
                                disabled={busy}
                                onPress={() => void sendKey('PRESET_' + preset.id)}
                                style={styles.presetButton}
                            >
                                {preset.containerArt ? (
                                    <Image accessibilityIgnoresInvertColors source={{uri: preset.containerArt}} style={styles.presetImage} testID={'preset-image-' + preset.id}/>
                                ) : (
                                    <Text style={styles.presetFallback}>{preset.name.toLowerCase()}</Text>
                                )}
                            </Pressable>
                        ))}
                    </View> : <Text style={styles.message}>No configured presets.</Text>}
                </View>
                {volume ? <View style={styles.card}>
                    <View style={styles.volumeHeader}>
                        <Text style={styles.sectionTitle}>Volume</Text>
                        <Text accessibilityLabel="Current volume" style={styles.volume}>{volume.muted ? 'Muted' : volume.target}</Text>
                    </View>
                    <View style={styles.volumeControls}>
                        <Pressable accessibilityLabel="Decrease volume" disabled={busy} onPress={() => void changeVolume(-1)} style={styles.volumeButton}>
                            <Text style={styles.volumeButtonText}>-</Text>
                        </Pressable>
                        <Slider
                            accessibilityLabel="Volume slider"
                            disabled={busy}
                            maximumTrackTintColor="#6b7280"
                            maximumValue={100}
                            minimumTrackTintColor="#f87171"
                            minimumValue={0}
                            onSlidingComplete={(value) => void setVolumeValue(value)}
                            onValueChange={(value) => setVolume((current) => {
                                const next = current ? {...current, target: value} : current;
                                volumeRef.current = next;
                                return next;
                            })}
                            step={1}
                            style={styles.slider}
                            value={volume.target}
                        />
                        <Pressable accessibilityLabel="Increase volume" disabled={busy} onPress={() => void changeVolume(1)} style={styles.volumeButton}>
                            <Text style={styles.volumeButtonText}>+</Text>
                        </Pressable>
                    </View>
                </View> : null}
                <View style={styles.controls}>
                    <Pressable disabled={busy} onPress={() => void sendKey('PLAY_PAUSE')} style={styles.button}>
                        <Text style={styles.buttonText}>Play / Pause</Text>
                    </Pressable>
                    <Pressable disabled={busy} onPress={() => void sendKey('POWER')} style={styles.button}>
                        <Text style={styles.buttonText}>{status?.source === 'STANDBY' ? 'Power On' : 'Power Off'}</Text>
                    </Pressable>
                </View>
            </ScrollView>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    safe: {flex: 1, backgroundColor: '#0b0b0b'},
    container: {flexGrow: 1, padding: 24, paddingTop: 0, gap: 16},
    title: {color: '#ffffff', fontSize: 32, fontWeight: '700'},
    address: {color: '#9ca3af', flexShrink: 1, fontSize: 15, textAlign: 'right'},
    message: {color: '#d1d5db', fontSize: 16},
    error: {color: '#f87171', fontSize: 16},
    card: {backgroundColor: '#1f2937', borderRadius: 16, padding: 18, gap: 8},
    sectionTitle: {color: '#f87171', fontSize: 14, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase'},
    statusHeader: {alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between'},
    value: {color: '#ffffff', fontSize: 17},
    statusTrackRow: {minHeight: 24, position: 'relative'},
    trackValue: {color: '#ffffff', fontSize: 17, lineHeight: 24, paddingRight: 48},
    presetGrid: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12},
    presetButton: {width: '31%', aspectRatio: 1, overflow: 'hidden', borderColor: '#6b7280', borderRadius: 12, borderWidth: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center'},
    presetImage: {width: '100%', height: '100%'},
    presetFallback: {color: '#ffffff', fontSize: 13, textAlign: 'center', padding: 8},
    volumeHeader: {minHeight: 34, justifyContent: 'center', position: 'relative'},
    volume: {color: '#ffffff', fontSize: 28, fontWeight: '700', left: 0, position: 'absolute', right: 0, textAlign: 'center'},
    volumeControls: {alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 999, flexDirection: 'row', gap: 4, overflow: 'hidden', paddingHorizontal: 4},
    slider: {flex: 1, height: 40},
    volumeButton: {alignItems: 'center', backgroundColor: '#ffffff', height: 48, justifyContent: 'center', width: 56},
    volumeButtonText: {color: '#111111', fontSize: 28, fontWeight: '700', lineHeight: 32},
    controls: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
    button: {backgroundColor: '#ffffff', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12},
    buttonText: {color: '#111111', fontSize: 15, fontWeight: '600'},
    refreshButton: {alignItems: 'center', borderColor: '#6b7280', borderRadius: 999, borderWidth: 1, height: 32, justifyContent: 'center', position: 'absolute', right: 0, top: -4, width: 32},
    refreshText: {color: '#ffffff', fontSize: 22, fontWeight: '700', lineHeight: 26}
});
