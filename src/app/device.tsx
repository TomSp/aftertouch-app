import {useLocalSearchParams} from 'expo-router';
import {useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

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

async function requestText(uri: string, options?: RequestInit) {
    const response = await fetch(uri, options);
    if (!response.ok) {
        throw new Error('Request failed with status ' + response.status);
    }
    return response.text();
}

export default function DeviceScreen() {
    const insets = useSafeAreaInsets();
    const {ip_address, name} = useLocalSearchParams<{ip_address?: string | string[]; name?: string | string[]}>();
    const ipAddress = parameter(ip_address);
    const deviceName = parameter(name) || ipAddress || 'Device';
    const baseUri = 'http://' + ipAddress + ':8090';
    const [status, setStatus] = useState<DeviceStatus | null>(null);
    const [volume, setVolume] = useState<VolumeStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function loadStatus() {
        if (!ipAddress) {
            setError('No device IP address was provided.');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const [nowPlayingXml, volumeXml] = await Promise.all([
                requestText(baseUri + '/now_playing'),
                requestText(baseUri + '/volume')
            ]);
            console.info('[Aftertouch] Device status response from ' + baseUri);
            setStatus({
                source: xmlAttribute(nowPlayingXml, 'nowPlaying', 'source') || 'Unknown',
                playStatus: xmlAttribute(nowPlayingXml, 'nowPlaying', 'playStatus') || 'Unknown',
                track: xmlTag(nowPlayingXml, 'track') || xmlTag(nowPlayingXml, 'trackTitle') || 'Not playing',
                artist: xmlTag(nowPlayingXml, 'artist') || xmlTag(nowPlayingXml, 'artistName') || ''
            });
            setVolume({
                target: Number(xmlTag(volumeXml, 'targetvolume')) || 0,
                actual: Number(xmlTag(volumeXml, 'actualvolume')) || 0,
                muted: xmlTag(volumeXml, 'muteenabled').toLowerCase() === 'true'
            });
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Unable to load device status.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadStatus();
    }, [ipAddress]);

    async function sendKey(key: string) {
        setBusy(true);
        setError(null);
        try {
            const body = (state: string) => '<key state="' + state + '" sender="Gabbo">' + key + '</key>';
            await requestText(baseUri + '/key', {method: 'POST', headers: {'Content-Type': 'application/xml'}, body: body('press')});
            await requestText(baseUri + '/key', {method: 'POST', headers: {'Content-Type': 'application/xml'}, body: body('release')});
            await loadStatus();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Unable to control device.');
        } finally {
            setBusy(false);
        }
    }

    async function changeVolume(delta: number) {
        if (!volume) {
            return;
        }

        const nextVolume = Math.max(0, Math.min(100, volume.target + delta));
        setBusy(true);
        setError(null);
        try {
            await requestText(baseUri + '/volume', {
                method: 'POST',
                headers: {'Content-Type': 'application/xml'},
                body: '<volume><targetvolume>' + nextVolume + '</targetvolume></volume>'
            });
            await loadStatus();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Unable to change volume.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <View style={StyleSheet.flatten([styles.safe, {paddingTop: insets.top, paddingBottom: insets.bottom}])}>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>{deviceName}</Text>
                <Text style={styles.address}>{ipAddress}:8090</Text>
                {loading ? <Text style={styles.message}>Loading status...</Text> : null}
                {error ? <Text style={styles.error}>{error}</Text> : null}
                {status ? <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Status</Text>
                    <Text style={styles.value}>Source: {status.source}</Text>
                    <Text style={styles.value}>Playback: {status.playStatus}</Text>
                    <Text style={styles.value}>Track: {status.track}</Text>
                    {status.artist ? <Text style={styles.value}>Artist: {status.artist}</Text> : null}
                </View> : null}
                {volume ? <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Volume</Text>
                    <Text style={styles.volume}>{volume.muted ? 'Muted' : volume.target + '%'}</Text>
                    <View style={styles.controls}>
                        <Pressable disabled={busy} onPress={() => void changeVolume(-5)} style={styles.button}>
                            <Text style={styles.buttonText}>Volume -</Text>
                        </Pressable>
                        <Pressable disabled={busy} onPress={() => void changeVolume(5)} style={styles.button}>
                            <Text style={styles.buttonText}>Volume +</Text>
                        </Pressable>
                    </View>
                </View> : null}
                <View style={styles.controls}>
                    <Pressable disabled={busy} onPress={() => void sendKey('PLAY_PAUSE')} style={styles.button}>
                        <Text style={styles.buttonText}>Play / Pause</Text>
                    </Pressable>
                    <Pressable disabled={busy} onPress={() => void sendKey('POWER')} style={styles.button}>
                        <Text style={styles.buttonText}>Power</Text>
                    </Pressable>
                </View>
                <Pressable disabled={busy} onPress={() => void loadStatus()} style={styles.refreshButton}>
                    <Text style={styles.refreshText}>Refresh status</Text>
                </Pressable>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    safe: {flex: 1, backgroundColor: '#0b0b0b'},
    container: {flexGrow: 1, padding: 24, gap: 16},
    title: {color: '#ffffff', fontSize: 32, fontWeight: '700'},
    address: {color: '#9ca3af', fontSize: 15},
    message: {color: '#d1d5db', fontSize: 16},
    error: {color: '#f87171', fontSize: 16},
    card: {backgroundColor: '#1f2937', borderRadius: 16, padding: 18, gap: 8},
    sectionTitle: {color: '#f87171', fontSize: 14, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase'},
    value: {color: '#ffffff', fontSize: 17},
    volume: {color: '#ffffff', fontSize: 28, fontWeight: '700'},
    controls: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
    button: {backgroundColor: '#ffffff', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12},
    buttonText: {color: '#111111', fontSize: 15, fontWeight: '600'},
    refreshButton: {alignSelf: 'flex-start', borderColor: '#6b7280', borderRadius: 999, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 12},
    refreshText: {color: '#ffffff', fontSize: 15, fontWeight: '600'}
});
