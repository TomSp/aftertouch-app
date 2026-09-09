import fs from 'node:fs';
import {fireEvent, render, waitFor} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import DeviceScreen from '../src/app/device';

const nowPlayingXml = fs.readFileSync('test-data/now-playing.xml', 'utf8');
const volumeXml = fs.readFileSync('test-data/volume.xml', 'utf8');
const keyResponseXml = fs.readFileSync('test-data/key-response.xml', 'utf8');

jest.mock('expo-router', () => ({
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
        global.fetch = jest.fn().mockImplementation((uri: string, options?: RequestInit) => {
            if (uri.endsWith('/now_playing')) {
                return Promise.resolve(response(nowPlayingXml));
            }
            if (uri.endsWith('/volume') && !options) {
                return Promise.resolve(response(volumeXml));
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

        expect(await screen.findByText('Source: STANDBY')).toBeTruthy();
        expect(screen.getByText('Playback: Unknown')).toBeTruthy();
        expect(screen.getByText('Track: Not playing')).toBeTruthy();
        expect(screen.getByText('25%')).toBeTruthy();
        expect(global.fetch).toHaveBeenCalledWith('http://192.168.1.187:8090/now_playing', undefined);
        expect(global.fetch).toHaveBeenCalledWith('http://192.168.1.187:8090/volume', undefined);
    });

    it('sends press and release requests through the key API', async () => {
        const screen = renderDevice();
        await screen.findByText('25%');

        fireEvent.press(screen.getByText('Play / Pause'));

        await waitFor(() => {
            const keyRequests = (global.fetch as jest.Mock).mock.calls.filter(([uri]) => uri.endsWith('/key'));
            expect(keyRequests).toHaveLength(2);
            expect(keyRequests[0][1]).toMatchObject({method: 'POST', body: '<key state="press" sender="Gabbo">PLAY_PAUSE</key>'});
            expect(keyRequests[1][1]).toMatchObject({method: 'POST', body: '<key state="release" sender="Gabbo">PLAY_PAUSE</key>'});
        });
    });

    it('sets the next volume through the volume API', async () => {
        const screen = renderDevice();
        await screen.findByText('25%');

        fireEvent.press(screen.getByText('Volume +'));

        await waitFor(() => {
            const volumeRequests = (global.fetch as jest.Mock).mock.calls.filter(([uri, options]) => uri.endsWith('/volume') && options);
            expect(volumeRequests).toHaveLength(1);
            expect(volumeRequests[0][1]).toMatchObject({method: 'POST', body: '<volume><targetvolume>30</targetvolume></volume>'});
        });
    });
});
