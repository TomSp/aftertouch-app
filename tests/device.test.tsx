import fs from 'node:fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {fireEvent, render, waitFor} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import DeviceScreen from '../src/app/device';

const nowPlayingXml = fs.readFileSync('test-data/now-playing.xml', 'utf8');
const volumeXml = fs.readFileSync('test-data/volume.xml', 'utf8');
const presetsXml = fs.readFileSync('test-data/presets.xml', 'utf8');
const keyResponseXml = fs.readFileSync('test-data/key-response.xml', 'utf8');

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('expo-haptics', () => ({
    selectionAsync: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('react-native-volume-manager', () => ({
    VolumeManager: {
        addVolumeListener: () => ({remove: jest.fn()}),
        showNativeVolumeUI: jest.fn().mockResolvedValue(undefined)
    }
}));

jest.mock('expo-router', () => ({
    Stack: {Screen: () => null},
    useLocalSearchParams: () => ({ip_address: '192.168.1.187', name: 'EZ SoundTouch'})
}));

function renderDevice() {
    return render(
        <SafeAreaProvider initialMetrics={{frame: {x: 0, y: 0, width: 320, height: 640}, insets: {top: 0, right: 0, bottom: 0, left: 0}}}>
            <DeviceScreen/>
        </SafeAreaProvider>
    );
}

function response(text: string) {
    return {ok: true, text: async () => text};
}

describe('DeviceScreen API interactions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
        global.fetch = jest.fn().mockImplementation((uri: string, options?: RequestInit) => {
            if (uri.endsWith('/now_playing')) {
                return Promise.resolve(response(nowPlayingXml));
            }
            if (uri.endsWith('/volume') && !options) {
                return Promise.resolve(response(volumeXml));
            }
            if (uri.endsWith('/presets')) {
                return Promise.resolve(response(presetsXml));
            }
            if (uri.endsWith('/key')) {
                return Promise.resolve(response(keyResponseXml));
            }
            if (uri.endsWith('/volume')) {
                return Promise.resolve(response(keyResponseXml));
            }
            return Promise.reject(new Error('Unexpected request: ' + uri));
        });
    });

    it('reads now-playing and volume status from their dedicated APIs', async () => {
        const screen = renderDevice();

        await waitFor(() => expect(screen.getByText(/STANDBY/)).toBeTruthy());
        expect(screen.getByText('Track: Not playing')).toBeTruthy();
        expect(screen.getByText('Power On')).toBeTruthy();
        expect(screen.getByText('25')).toBeTruthy();
        expect(screen.getByLabelText('Preset 1: 94.3 RS2')).toBeTruthy();
        expect(screen.getByTestId('preset-image-1').props.source).toEqual({uri: 'http://cdn-profiles.tunein.com/s25221/images/logoq.jpg?t=2'});
        expect(screen.getByLabelText('Preset 2: Berliner Rundfunk')).toBeTruthy();
        expect(screen.getByLabelText('Preset 3: Radio Erzgebirge - Weihnachtsradio')).toBeTruthy();
        expect(screen.getByLabelText('Preset 4: rbb24 Inforadio')).toBeTruthy();
        expect(screen.getByLabelText('Preset 5: 104.6 RTL Berlins Hit-Radio')).toBeTruthy();
        expect(screen.getByLabelText('Preset 6: Silvester-Playlist')).toBeTruthy();
        expect(screen.getByText('silvester-playlist')).toBeTruthy();
        expect(global.fetch).toHaveBeenCalledWith('http://192.168.1.187:8090/now_playing', undefined);
        expect(global.fetch).toHaveBeenCalledWith('http://192.168.1.187:8090/volume', undefined);
        expect(global.fetch).toHaveBeenCalledWith('http://192.168.1.187:8090/presets', undefined);
    });

    it('sends press and release requests through the key API', async () => {
        const screen = renderDevice();
        await screen.findByText('25');

        fireEvent.press(screen.getByText('Play / Pause'));

        await waitFor(() => {
            const keyRequests = (global.fetch as jest.Mock).mock.calls.filter(([uri]) => uri.endsWith('/key'));
            expect(keyRequests).toHaveLength(2);
            expect(keyRequests[0][1]).toMatchObject({method: 'POST', body: '<key state="press" sender="Gabbo">PLAY_PAUSE</key>'});
            expect(keyRequests[1][1]).toMatchObject({method: 'POST', body: '<key state="release" sender="Gabbo">PLAY_PAUSE</key>'});
            expect((global.fetch as jest.Mock).mock.calls.filter(([uri]) => uri.endsWith('/now_playing'))).toHaveLength(2);
        }, {timeout: 4000});
    });

    it('provides haptic feedback when the power button is pressed and enabled', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue('true');
        const screen = renderDevice();
        await screen.findByText('25');

        fireEvent.press(screen.getByText('Power On'));

        expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
        await waitFor(() => {
            expect((global.fetch as jest.Mock).mock.calls.filter(([uri]) => uri.endsWith('/now_playing'))).toHaveLength(2);
        }, {timeout: 4000});
    });

    it('sets the next volume through the volume API', async () => {
        const screen = renderDevice();
        await screen.findByText('25');

        fireEvent.press(screen.getByLabelText('Increase volume'));

        await waitFor(() => {
            const volumeRequests = (global.fetch as jest.Mock).mock.calls.filter(([uri, options]) => uri.endsWith('/volume') && options);
            expect(volumeRequests).toHaveLength(1);
            expect(volumeRequests[0][1]).toMatchObject({method: 'POST', body: '<volume>26</volume>'});
            expect((global.fetch as jest.Mock).mock.calls.filter(([uri]) => uri.endsWith('/now_playing'))).toHaveLength(2);
            expect(screen.getByLabelText('Volume slider').props.value).toBe(25);
        }, {timeout: 4000});
    });
});
