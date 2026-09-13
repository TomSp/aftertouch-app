import AsyncStorage from '@react-native-async-storage/async-storage';
import {Stack, useLocalSearchParams, useRouter} from 'expo-router';
import {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {LIBRARY_STATE_KEY_PREFIX} from '../libraryState';

type LibraryItem = {
    path: string;
    name: string;
    subtitle: string;
    image: string;
    playable: boolean;
    isDir: boolean;
    account?: string;
    location?: string;
    type?: string;
    mediaServerId?: string;
};

type LibraryBreadcrumb = {
    path: string;
    name: string;
};

type LibraryResponse = {
    data?: {
        bmx_sections?: Array<{
            items?: LibraryResponseItem[];
        }>;
        entries?: LibraryEntry[];
    };
    items?: LibraryResponseItem[];
};

type LibraryEntry = {
    name?: string;
    type?: string;
    location?: string;
    sourceAccount?: string;
    playable?: boolean;
    isDir?: boolean;
};

type LibraryResponseItem = {
    name?: string;
    title?: string;
    subtitle?: string;
    description?: string;
    imageUrl?: string;
    image?: string;
    path?: string;
    _links?: {
        bmx_navigate?: { href?: string };
        navigate?: { href?: string };
    };
};

const SOURCE_STORAGE_KEY = 'aftertouch.source';
const LIBRARY_ROOT_STORAGE_KEY = 'aftertouch.library.root';

function parameter(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function cleanNavigatePath(path: string) {
    return path.replace(/^\/v1(?=\/|$)/, '');
}

function xmlAttribute(xml: string, tag: string, attribute: string) {
    const match = xml.match(new RegExp('<' + tag + '\\b[^>]*\\b' + attribute + '=\"([^\"]*)\"'));
    return match?.[1] ?? '';
}

function parseMediaServers(payload: string): LibraryItem[] {
    const servers: LibraryItem[] = [];
    const serverPattern = /<media_server\b[^>]*\/>/g;
    let match = serverPattern.exec(payload);

    while (match) {
        const serverXml = match[0];
        const id = xmlAttribute(serverXml, 'media_server', 'id');
        const name = xmlAttribute(serverXml, 'media_server', 'friendly_name') || xmlAttribute(serverXml, 'media_server', 'model_name') || xmlAttribute(serverXml, 'media_server', 'ip');
        if (id && name) {
            const manufacturer = xmlAttribute(serverXml, 'media_server', 'manufacturer');
            const model = xmlAttribute(serverXml, 'media_server', 'model_name');
            const ip = xmlAttribute(serverXml, 'media_server', 'ip');
            servers.push({
                path: '/browse?account=' + encodeURIComponent(id + '/0'),
                name,
                subtitle: [manufacturer, model, ip].filter(Boolean).join(' - '),
                image: '',
                playable: false,
                isDir: true,
                mediaServerId: id
            });
        }
        match = serverPattern.exec(payload);
    }

    return servers;
}

function parseLibraryItems(payload: string): LibraryItem[] {
    let response: LibraryResponse;
    try {
        response = JSON.parse(payload) as LibraryResponse;
    } catch {
        return [];
    }

    const entries = response.data?.entries ?? [];
    if (entries.length > 0) {
        return entries.flatMap((entry) => {
            const account = entry.sourceAccount ?? '';
            const location = entry.location ?? '';
            const name = entry.name?.trim() ?? '';
            if (!account || !location || !name) {
                return [];
            }

            return [{
                path: '/browse?account=' + encodeURIComponent(account) + '&location=' + encodeURIComponent(location) + '&type=' + encodeURIComponent(entry.type ?? ''),
                name,
                subtitle: entry.type ?? '',
                image: '',
                playable: entry.playable === true,
                isDir: entry.isDir === true,
                account,
                location,
                type: entry.type ?? ''
            }];
        });
    }

    const sections = response.data?.bmx_sections ?? [];
    const items = sections.length > 0
        ? sections.flatMap((section) => section.items ?? [])
        : response.items ?? [];

    return items.flatMap((item) => {
        const path = cleanNavigatePath(item._links?.bmx_navigate?.href ?? item._links?.navigate?.href ?? item.path ?? '');
        const name = (item.name ?? item.title ?? '').trim();
        if (!path || !name) {
            return [];
        }

        return [{
            path,
            name,
            subtitle: (item.subtitle ?? item.description ?? '').trim(),
            image: item.imageUrl ?? item.image ?? '',
            playable: false,
            isDir: true
        }];
    });
}

async function requestText(uri: string, options?: RequestInit) {
    const response = await fetch(uri, options);
    if (!response.ok) {
        throw new Error('Request failed with status ' + response.status);
    }
    return response.text();
}

export default function LibraryScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const {ip_address, name, select_root} = useLocalSearchParams<{ip_address?: string | string[]; name?: string | string[]; select_root?: string | string[]}>();
    const ipAddress = parameter(ip_address);
    const selectingRoot = parameter(select_root) === 'true';
    const deviceName = parameter(name) || ipAddress || 'Device';
    const [sourceBaseUri, setSourceBaseUri] = useState('');
    const deviceBaseUri = 'http://' + ipAddress + ':8090';
    const [items, setItems] = useState<LibraryItem[]>([]);
    const [breadcrumbs, setBreadcrumbs] = useState<LibraryBreadcrumb[]>([]);
    const [browsePath, setBrowsePath] = useState('');
    const breadcrumbScrollRef = useRef<ScrollView>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        async function restoreLibrary() {
            try {
                const [storedSource, storedState, storedRoot] = await Promise.all([
                    AsyncStorage.getItem(SOURCE_STORAGE_KEY),
                    ipAddress ? AsyncStorage.getItem(LIBRARY_STATE_KEY_PREFIX + ipAddress) : Promise.resolve(null),
                    AsyncStorage.getItem(LIBRARY_ROOT_STORAGE_KEY)
                ]);
                if (!mounted) {
                    return;
                }

                const nextSource = storedSource?.trim().replace(/\/+$/, '') ?? '';
                setSourceBaseUri(nextSource);

                let savedState: {path?: string; breadcrumbs?: LibraryBreadcrumb[]} | null = null;
                try {
                    savedState = storedState ? JSON.parse(storedState) as {path?: string; breadcrumbs?: LibraryBreadcrumb[]} : null;
                } catch {
                    savedState = null;
                }

                if (ipAddress) {
                    let configuredRoot = '';
                    try { configuredRoot = storedRoot ? (JSON.parse(storedRoot) as {path?: string}).path ?? '' : storedRoot?.trim() ?? ''; } catch { configuredRoot = storedRoot?.trim() ?? ''; }
                    const path = selectingRoot ? '' : savedState?.path ?? configuredRoot;
                    const savedBreadcrumbs = Array.isArray(savedState?.breadcrumbs) ? savedState.breadcrumbs : undefined;
                    await browse(path, savedBreadcrumbs?.at(-1)?.name ?? 'Library', savedBreadcrumbs, nextSource);
                }
            } catch {
                if (mounted && ipAddress) {
                    await browse();
                }
            }
        }

        void restoreLibrary();

        return () => {
            mounted = false;
        };
    }, [ipAddress, selectingRoot]);

    useEffect(() => {
        if (breadcrumbs.length > 0) {
            requestAnimationFrame(() => breadcrumbScrollRef.current?.scrollToEnd({animated: false}));
        }
    }, [breadcrumbs]);

    async function browse(path = '', itemName = 'Library', breadcrumbOverride?: LibraryBreadcrumb[], sourceOverride = sourceBaseUri) {
        if (!ipAddress || (path && !sourceOverride)) {
            return;
        }

        const nextBreadcrumbs = breadcrumbOverride ?? (path ? [...breadcrumbs, {path: browsePath, name: itemName}] : []);
        setLoading(true);
        setError(null);
        try {
            const target = path ? sourceOverride + '/api/control/devices/' + ipAddress + '/library' + path : deviceBaseUri + '/listMediaServers';
            const result = await requestText(target);
            setBreadcrumbs(nextBreadcrumbs);
            setBrowsePath(path);
            setItems(path ? parseLibraryItems(result) : parseMediaServers(result));
            if (ipAddress) {
                void AsyncStorage.setItem(LIBRARY_STATE_KEY_PREFIX + ipAddress, JSON.stringify({path, breadcrumbs: nextBreadcrumbs}));
            }
        } catch (requestError) {
            setItems([]);
            setError(requestError instanceof Error ? requestError.message : 'Unable to browse library.');
        } finally {
            setLoading(false);
        }
    }

    async function selectItemAsRoot(item: LibraryItem) {
        if (!ipAddress || !item.isDir || !item.path) return;
        await AsyncStorage.setItem(LIBRARY_ROOT_STORAGE_KEY, JSON.stringify({path: item.path, name: item.name}));
        await AsyncStorage.removeItem(LIBRARY_STATE_KEY_PREFIX + ipAddress);
        router.back();
    }

    async function playItem(item: LibraryItem) {
        if (!sourceBaseUri || !item.account || !item.location || !item.type) {
            return;
        }

        setLoading(true);
        setError(null);
        try {
            await requestText(sourceBaseUri + '/api/control/devices/' + ipAddress + '/library/play', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    account: item.account,
                    location: item.location,
                    type: item.type,
                    name: item.name
                })
            });
            router.back();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Unable to play library item.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <Stack.Screen options={{
                title: deviceName + ' Library',
                headerTitle: () => (
                    <Pressable accessibilityLabel={'Back to ' + deviceName} accessibilityRole="button"
                               onPress={() => router.back()} style={styles.headerTitle}>
                        <Text numberOfLines={1} style={styles.headerTitleText}>{deviceName + ' Library'}</Text>
                    </Pressable>
                )
            }}/>
            <View style={StyleSheet.flatten([styles.safe, {paddingBottom: insets.bottom}])}>
                {breadcrumbs.length > 0 ? (
                    <View style={styles.stickyHeader}>
                        <ScrollView
                            horizontal
                            contentContainerStyle={styles.breadcrumbs}
                            style={styles.breadcrumbScroll}
                            onContentSizeChange={() => breadcrumbScrollRef.current?.scrollToEnd({animated: false})}
                            ref={breadcrumbScrollRef}
                            showsHorizontalScrollIndicator={false}
                        >
                            {breadcrumbs.map((breadcrumb, index) => (
                                <Pressable
                                    accessibilityLabel={'Back to ' + breadcrumb.name}
                                    disabled={loading}
                                    key={breadcrumb.path + breadcrumb.name}
                                    onPress={() => void browse(breadcrumb.path, 'Library', breadcrumbs.slice(0, index))}
                                    style={styles.breadcrumb}
                                >
                                    <Text style={styles.breadcrumbText}>{'< ' + breadcrumb.name}</Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>
                ) : null}
                <ScrollView contentContainerStyle={styles.container}>
                    {error ? <Text style={styles.error}>{error}</Text> : null}
                    {!loading && !error && items.length === 0 ? <Text style={styles.message}>No media servers found.</Text> : null}
                    {items.map((item) => (
                        <Pressable
                            accessibilityLabel={'Browse ' + item.name}
                            disabled={loading || !item.isDir}
                            key={item.path}
                            onPress={() => item.isDir ? void browse(item.path, item.name) : undefined}
                            style={StyleSheet.flatten([styles.item, !item.isDir && styles.itemDisabled])}
                        >
                            {item.image ? <Image accessibilityIgnoresInvertColors source={{uri: item.image}} style={styles.itemImage}/> : null}
                            <View style={styles.itemCopy}>
                                <Text style={styles.itemName}>{item.name}</Text>
                                {item.subtitle ? <Text style={styles.itemSubtitle}>{item.subtitle}</Text> : null}
                            </View>
                            {selectingRoot && item.isDir ? (
                                <Pressable
                                    accessibilityLabel={'Select ' + item.name + ' as Library root'}
                                    disabled={loading}
                                    onPress={(event) => {
                                        event?.stopPropagation();
                                        void selectItemAsRoot(item);
                                    }}
                                    style={styles.selectRootButton}
                                >
                                    <Text style={styles.selectRootButtonText}>Select</Text>
                                </Pressable>
                            ) : null}
                            {item.playable && !selectingRoot ? (
                                <Pressable
                                    accessibilityLabel={'Play ' + item.name}
                                    disabled={loading}
                                    onPress={(event) => {
                                        event?.stopPropagation();
                                        void playItem(item);
                                    }}
                                    style={styles.playButton}
                                >
                                    <Text style={styles.playButtonText}>▶</Text>
                                </Pressable>
                            ) : null}
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
    loadingOverlay: {
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        bottom: 0,
        justifyContent: 'center',
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0
    },
    container: {flexGrow: 1, padding: 24, gap: 12},
    stickyHeader: {backgroundColor: '#0b0b0b', paddingHorizontal: 24, paddingTop: 12, zIndex: 1},
    headerTitle: {maxWidth: 220},
    headerTitleText: {color: '#f5f5f5', fontSize: 18, fontWeight: '600'},
    breadcrumbScroll: {flexGrow: 0, height: 40},
    breadcrumbs: {alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 40},
    breadcrumb: {paddingHorizontal: 4, paddingVertical: 6},
    breadcrumbText: {color: '#f87171', fontSize: 16, fontWeight: '600'},
    item: {alignItems: 'center', backgroundColor: '#1f2937', borderRadius: 12, flexDirection: 'row', gap: 14, minHeight: 72, padding: 12},
    itemDisabled: {opacity: 0.82},
    itemImage: {backgroundColor: '#111827', borderRadius: 8, height: 48, width: 48},
    itemCopy: {flex: 1, gap: 4},
    itemName: {color: '#ffffff', fontSize: 17, fontWeight: '600'},
    itemSubtitle: {color: '#9ca3af', fontSize: 14},
    selectRootButton: {alignItems: 'center', backgroundColor: '#f87171', borderRadius: 10, justifyContent: 'center', minHeight: 44, paddingHorizontal: 12},
    selectRootButtonText: {color: '#111111', fontSize: 15, fontWeight: '600'},
    playButton: {alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 999, height: 44, justifyContent: 'center', width: 44},
    playButtonText: {color: '#111111', fontSize: 20, fontWeight: '700', lineHeight: 24, marginLeft: 2, textAlign: 'center'},
    message: {color: '#d1d5db', fontSize: 16},
    error: {color: '#f87171', fontSize: 16}
});
