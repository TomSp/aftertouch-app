import fs from 'node:fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {fireEvent, render, waitFor} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import LibraryScreen from '../src/app/library';

const mediaServersResponse = fs.readFileSync('test-data/list-media-servers.xml', 'utf8');
const rootBrowseResponse = fs.readFileSync('test-data/library-root-browse.json', 'utf8');
const musicBrowseResponse = fs.readFileSync('test-data/library-music-browse.json', 'utf8');
const mockBack = jest.fn();
const savedMusicState = JSON.stringify({path: '/browse?account=4d696e69-444c-164e-9d41-50c7bfbaf54a%2F0&location=1&type=dir', breadcrumbs: [{path: '', name: 'TomsArcher'}, {path: '/browse?account=4d696e69-444c-164e-9d41-50c7bfbaf54a%2F0', name: 'Music'}]});

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn().mockResolvedValue('http://azsound.home.spengler.berlin:8000'),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('expo-router', () => ({
    Stack: {Screen: ({options}: {options?: {headerTitle?: () => React.ReactNode}}) => options?.headerTitle?.() ?? null},
    useLocalSearchParams: () => ({ip_address: '192.168.1.187', name: 'EZ SoundTouch'}),
    useRouter: () => ({back: mockBack})
}));

function renderLibrary() {
    return render(
        <SafeAreaProvider initialMetrics={{frame: {x: 0, y: 0, width: 320, height: 640}, insets: {top: 0, right: 0, bottom: 0, left: 0}}}>
            <LibraryScreen/>
        </SafeAreaProvider>
    );
}

describe('LibraryScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => Promise.resolve(key.startsWith('aftertouch.library.state.') ? null : 'http://azsound.home.spengler.berlin:8000'));
        global.fetch = jest.fn().mockImplementation((uri: string) => Promise.resolve({
            ok: true,
            text: async () => uri.includes('location=1&type=dir') ? musicBrowseResponse : uri.includes('/api/control/devices/192.168.1.187/library/browse') ? rootBrowseResponse : mediaServersResponse
        }));
    });

    it('loads media servers from the selected device and browses the selected server through the configured source', async () => {
        const screen = renderLibrary();

        expect(await screen.findByText('TomsArcher')).toBeTruthy();
        expect(screen.getByText('TP-Link - Archer VR900v - 192.168.1.4')).toBeTruthy();
        expect(screen.queryByLabelText('Play TomsArcher')).toBeNull();
        expect(global.fetch).toHaveBeenCalledWith('http://192.168.1.187:8090/listMediaServers', undefined);

        fireEvent.press(screen.getByLabelText('Browse TomsArcher'));

        expect(await screen.findByText('Browse Folders')).toBeTruthy();
        expect(screen.getByLabelText('Play Browse Folders')).toBeTruthy();
        expect(screen.getByText('Music')).toBeTruthy();
        expect(screen.getByLabelText('Play Music')).toBeTruthy();
        expect(screen.getByText('Pictures')).toBeTruthy();
        expect(screen.getByText('Video')).toBeTruthy();
        await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('http://azsound.home.spengler.berlin:8000/api/control/devices/192.168.1.187/library/browse?account=4d696e69-444c-164e-9d41-50c7bfbaf54a%2F0', undefined));

        fireEvent.press(screen.getByLabelText('Browse Music'));

        expect(await screen.findByText('Album')).toBeTruthy();
        expect(screen.getByLabelText('Play Album')).toBeTruthy();
        expect(screen.getByText('All Music')).toBeTruthy();
        expect(screen.getByLabelText('Play All Music')).toBeTruthy();
        expect(screen.getByLabelText('Browse All Music')).toBeDisabled();
        fireEvent.press(screen.getByLabelText('Browse All Music'));
        expect(global.fetch).not.toHaveBeenCalledWith('http://azsound.home.spengler.berlin:8000/api/control/devices/192.168.1.187/library/browse?account=4d696e69-444c-164e-9d41-50c7bfbaf54a%2F0&location=1%244&type=track');
        fireEvent.press(screen.getByLabelText('Play All Music'));
        await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('http://azsound.home.spengler.berlin:8000/api/control/devices/192.168.1.187/library/play', expect.objectContaining({
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({account: '4d696e69-444c-164e-9d41-50c7bfbaf54a/0', location: '1$4', type: 'track', name: 'All Music'})
        })));
        expect(mockBack).toHaveBeenCalled();
        expect(screen.getByText('Artist')).toBeTruthy();
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('aftertouch.library.state.192.168.1.187', expect.stringContaining('location=1&type=dir'));
        await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('http://azsound.home.spengler.berlin:8000/api/control/devices/192.168.1.187/library/browse?account=4d696e69-444c-164e-9d41-50c7bfbaf54a%2F0&location=1&type=dir', undefined));
    });

    it('restores the last browse location when reopened', async () => {
        (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => Promise.resolve(
            key.startsWith('aftertouch.library.state.') ? savedMusicState : 'http://azsound.home.spengler.berlin:8000'
        ));

        const screen = renderLibrary();

        expect(await screen.findByText('Album')).toBeTruthy();
        expect(screen.getByLabelText('Back to Music')).toBeTruthy();
        expect(global.fetch).toHaveBeenCalledWith('http://azsound.home.spengler.berlin:8000/api/control/devices/192.168.1.187/library/browse?account=4d696e69-444c-164e-9d41-50c7bfbaf54a%2F0&location=1&type=dir', undefined);
    });

    it('returns to the device screen from the header title', async () => {
        const screen = renderLibrary();

        await screen.findByText('TomsArcher');
        fireEvent.press(screen.getByLabelText('Back to EZ SoundTouch'));

        expect(mockBack).toHaveBeenCalled();
    });
});
