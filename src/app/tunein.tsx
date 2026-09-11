import {Stack, useLocalSearchParams, useRouter} from 'expo-router';
import {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

type Station = {
    id: string;
    location: string;
    name: string;
    image: string;
};

type BrowseItem = {
    path: string;
    name: string;
    subtitle: string;
};

type BrowseBreadcrumb = {
    path: string;
    name: string;
};

function parameter(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

type SearchResponse = {
    data?: {
        bmx_sections?: Array<{
            items?: Array<{
                name?: string;
                subtitle?: string;
                imageUrl?: string;
                _links?: {
                    bmx_playback?: {href?: string};
                    bmx_navigate?: {href?: string};
                };
            }>;
        }>;
    };
};

function parseStations(payload: string): Station[] {
    let response: SearchResponse;
    try {
        response = JSON.parse(payload) as SearchResponse;
    } catch {
        return [];
    }

    return (response.data?.bmx_sections ?? []).flatMap((section) => (section.items ?? []).flatMap((item) => {
        const playbackHref = item._links?.bmx_playback?.href ?? '';
        const id = playbackHref.match(/\/station\/([^/?]+)/)?.[1] ?? '';
        const name = item.name?.trim() ?? '';
        if (!id || !name) {
            return [];
        }

        return [{id, location: playbackHref, name, image: item.imageUrl ?? ''}];
    }));
}

function parseBrowseItems(payload: string): BrowseItem[] {
    let response: SearchResponse;
    try {
        response = JSON.parse(payload) as SearchResponse;
    } catch {
        return [];
    }

    return (response.data?.bmx_sections ?? []).flatMap((section) => (section.items ?? []).flatMap((item) => {
        const navigateHref = (item._links?.bmx_navigate?.href ?? '').replace(/^\/v1(?=\/|$)/, '');
        const name = item.name?.trim() ?? '';
        if (!navigateHref || !name) {
            return [];
        }

        return [{path: navigateHref, name, subtitle: item.subtitle?.trim() ?? ''}];
    }));
}

async function requestText(uri: string, options?: RequestInit) {
    const response = await fetch(uri, options);
    if (!response.ok) {
        throw new Error('Request failed with status ' + response.status);
    }
    return response.text();
}

export default function TuneInScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const {ip_address, name} = useLocalSearchParams<{ip_address?: string | string[]; name?: string | string[]}>();
    const ipAddress = parameter(ip_address);
    const deviceName = parameter(name) || ipAddress || 'Device';
    const tuneInBaseUri = 'http://' + ipAddress + ':8000/api/control/providers/tunein';
    const tuneInDeviceBaseUri = 'http://' + ipAddress + ':8000/api/control/devices/' + ipAddress + '/providers/tunein';
    const [query, setQuery] = useState('');
    const [stations, setStations] = useState<Station[]>([]);
    const [browseItems, setBrowseItems] = useState<BrowseItem[]>([]);
    const [browseBreadcrumbs, setBrowseBreadcrumbs] = useState<BrowseBreadcrumb[]>([]);
    const [browsePath, setBrowsePath] = useState('');
    const [browseName, setBrowseName] = useState('TuneIn');
    const breadcrumbScrollRef = useRef<ScrollView>(null);
    const [loading, setLoading] = useState(false);
    const [selecting, setSelecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (browseBreadcrumbs.length > 0) {
            requestAnimationFrame(() => breadcrumbScrollRef.current?.scrollToEnd({animated: false}));
        }
    }, [browseBreadcrumbs]);


    async function search() {
        const trimmedQuery = query.trim();
        if (!ipAddress || !trimmedQuery) {
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const result = await requestText(tuneInBaseUri + '/search?q=' + encodeURIComponent(trimmedQuery));
            setBrowseItems([]);
            setBrowseBreadcrumbs([]);
            setBrowsePath('');
            setBrowseName('TuneIn');
            setStations(parseStations(result));
        } catch (requestError) {
            setStations([]);
            setError(requestError instanceof Error ? requestError.message : 'Unable to search TuneIn.');
        } finally {
            setLoading(false);
        }
    }

    async function browse(path = '', name = 'TuneIn', breadcrumbOverride?: BrowseBreadcrumb[]) {
        if (!ipAddress) {
            return;
        }

        const breadcrumbs = breadcrumbOverride ?? (path ? [...browseBreadcrumbs, {path: browsePath, name}] : []);
        setLoading(true);
        setError(null);
        try {
            const target = path
                ? tuneInBaseUri + path
                : tuneInBaseUri + '/navigate';
            console.info('[Aftertouch] navigate target' + target);
            const result = await requestText(target);
            setBrowseBreadcrumbs(breadcrumbs);
            setBrowsePath(path);
            setBrowseName(name);
            setBrowseItems(parseBrowseItems(result));
            setStations(parseStations(result));
        } catch (requestError) {
            setBrowseItems([]);
            setError(requestError instanceof Error ? requestError.message : 'Unable to browse TuneIn.');
        } finally {
            setLoading(false);
        }
    }

    async function selectStation(station: Station) {
        setSelecting(true);
        setError(null);
        try {
            const body = JSON.stringify({location: station.location, type: 'stationurl', name: station.name, containerArt: ''});
            await requestText(tuneInDeviceBaseUri + '/play', {method: 'POST', headers: {'Content-Type': 'application/json'}, body});
            router.back();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Unable to select station.');
        } finally {
            setSelecting(false);
        }
    }

    return (
        <>
            <Stack.Screen options={{title: deviceName + ' TuneIn'}}/>
            <View style={StyleSheet.flatten([styles.safe, {paddingBottom: insets.bottom}])}>
                <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                    <View style={styles.searchRow}>
                        <TextInput
                            accessibilityLabel="TuneIn search"
                            autoCapitalize="none"
                            autoCorrect={false}
                            onChangeText={setQuery}
                            onSubmitEditing={() => void search()}
                            placeholder="Search radio stations"
                            placeholderTextColor="#9ca3af"
                            returnKeyType="search"
                            style={styles.input}
                            value={query}
                        />
                        <Pressable accessibilityLabel="Search TuneIn" disabled={loading || selecting || !ipAddress || !query.trim()} onPress={() => void search()} style={styles.searchButton}>
                            <Text style={styles.searchButtonText}>⌕</Text>
                        </Pressable>
                        <Pressable accessibilityLabel="Browse TuneIn" disabled={loading || selecting || !ipAddress} onPress={() => void browse()} style={styles.browseButton}>
                            <Text style={styles.browseButtonText}>Browse</Text>
                        </Pressable>
                    </View>
                    {error ? <Text style={styles.error}>{error}</Text> : null}
                    {!loading && !error && query.trim() && stations.length === 0 && browseItems.length === 0 ? <Text style={styles.message}>No stations found.</Text> : null}
                    {browseBreadcrumbs.length > 0 ? (
                        <ScrollView
                            horizontal
                            contentContainerStyle={styles.breadcrumbs}
                            style={styles.breadcrumbScroll}
                            onContentSizeChange={() => breadcrumbScrollRef.current?.scrollToEnd({animated: false})}
                            ref={breadcrumbScrollRef}
                            showsHorizontalScrollIndicator={false}
                        >
                            {browseBreadcrumbs.map((breadcrumb, index) => (
                                <Pressable
                                    accessibilityLabel={'Back to ' + breadcrumb.name}
                                    disabled={loading || selecting}
                                    key={breadcrumb.path + breadcrumb.name}
                                    onPress={() => void browse(breadcrumb.path, 'TuneIn', browseBreadcrumbs.slice(0, index))}
                                    style={styles.breadcrumb}
                                >
                                    <Text style={styles.breadcrumbText}>{'‹ ' + breadcrumb.name}</Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    ) : null}
                    {browseItems.map((item) => (
                        <Pressable
                            accessibilityLabel={'Browse ' + item.name}
                            disabled={loading || selecting}
                            key={item.path}
                            onPress={() => void browse(item.path, item.name)}
                            style={styles.browseItem}
                        >
                            <Text style={styles.browseName}>{item.name}</Text>
                            {item.subtitle ? <Text style={styles.browseSubtitle}>{item.subtitle}</Text> : null}
                        </Pressable>
                    ))}
                    {stations.map((station) => (
                        <Pressable
                            accessibilityLabel={'Select ' + station.name}
                            disabled={selecting}
                            key={station.id}
                            onPress={() => void selectStation(station)}
                            style={styles.station}
                        >
                            {station.image ? <Image accessibilityIgnoresInvertColors source={{uri: station.image}} style={styles.stationImage}/> : null}
                            <Text numberOfLines={2} style={styles.stationName}>{station.name}</Text>
                        </Pressable>
                    ))}
                </ScrollView>
                {loading ? (
                    <View pointerEvents="auto" style={styles.loadingOverlay}>
                        <ActivityIndicator color="#f87171" size="large"/>
                    </View>
                ) : null}
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    safe: {flex: 1, backgroundColor: '#0b0b0b'},
    loadingOverlay: {alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.55)', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0},
    container: {flexGrow: 1, padding: 24, gap: 12},
    searchRow: {alignItems: 'center', flexDirection: 'row', gap: 8},
    input: {borderColor: '#6b7280', borderRadius: 10, borderWidth: 1, color: '#ffffff', flex: 1, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12},
    searchButton: {alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 10, height: 48, justifyContent: 'center', width: 52},
    searchButtonText: {color: '#111111', fontSize: 28, lineHeight: 32},
    browseButton: {alignItems: 'center', backgroundColor: '#f87171', borderRadius: 10, height: 48, justifyContent: 'center', paddingHorizontal: 14},
    browseButtonText: {color: '#111111', fontSize: 15, fontWeight: '600'},
    station: {alignItems: 'center', backgroundColor: '#1f2937', borderRadius: 12, flexDirection: 'row', gap: 14, minHeight: 72, padding: 12},
    stationImage: {backgroundColor: '#111827', borderRadius: 8, height: 48, width: 48},
    stationName: {color: '#ffffff', flex: 1, fontSize: 17},
    browseItem: {backgroundColor: '#1f2937', borderRadius: 12, gap: 4, padding: 16},
    breadcrumbScroll: {flexGrow: 0, height: 40},
    breadcrumbs: {alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 40},
    breadcrumb: {paddingHorizontal: 4, paddingVertical: 6},
    breadcrumbText: {color: '#f87171', fontSize: 16, fontWeight: '600'},
    browseName: {color: '#ffffff', fontSize: 17, fontWeight: '600'},
    browseSubtitle: {color: '#9ca3af', fontSize: 14},
    message: {color: '#d1d5db', fontSize: 16},
    error: {color: '#f87171', fontSize: 16}
});
