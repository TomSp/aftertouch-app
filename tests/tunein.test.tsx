import fs from 'node:fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {fireEvent, render, waitFor} from '@testing-library/react-native';
import {Keyboard} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import TuneInScreen from '../src/app/tunein';

const searchResponse = fs.readFileSync('test-data/tunein-search.json', 'utf8');
const browseResponse = fs.readFileSync('test-data/tunein-navigate.json', 'utf8');
const mockBack = jest.fn();
const keyboardDismissSpy = jest.spyOn(Keyboard, 'dismiss').mockImplementation(jest.fn());

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

describe('TuneInScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue('http://azsound.home.spengler.berlin:8000');
        global.fetch = jest.fn().mockImplementation((uri: string) => Promise.resolve({ok: true, text: async () => uri.includes('/navigate') ? browseResponse : searchResponse}));
    });

    it('searches the targeted device and renders station results', async () => {
        const screen = render(
            <SafeAreaProvider initialMetrics={{frame: {x: 0, y: 0, width: 320, height: 640}, insets: {top: 0, right: 0, bottom: 0, left: 0}}}>
                <TuneInScreen/>
            </SafeAreaProvider>
        );

        fireEvent.changeText(screen.getByLabelText('TuneIn search'), '94,3');
        await waitFor(() => expect(screen.getByLabelText('Search TuneIn')).not.toBeDisabled());
        fireEvent.press(screen.getByLabelText('Search TuneIn'));

        await waitFor(() => expect(screen.getAllByLabelText('Select 94,3 RS2').length).toBeGreaterThan(0));
        expect(global.fetch).toHaveBeenCalledWith('http://azsound.home.spengler.berlin:8000/api/control/providers/tunein/search?q=94%2C3', undefined);
    });

    it('returns to the device screen from the header title', async () => {
        const screen = render(
            <SafeAreaProvider initialMetrics={{frame: {x: 0, y: 0, width: 320, height: 640}, insets: {top: 0, right: 0, bottom: 0, left: 0}}}>
                <TuneInScreen/>
            </SafeAreaProvider>
        );

        await waitFor(() => expect(screen.getByLabelText('Browse TuneIn')).not.toBeDisabled());
        fireEvent.press(screen.getByLabelText('Back to EZ SoundTouch'));

        expect(mockBack).toHaveBeenCalled();
    });

    it('selects a station on the device and returns to the device screen', async () => {
        const screen = render(
            <SafeAreaProvider initialMetrics={{frame: {x: 0, y: 0, width: 320, height: 640}, insets: {top: 0, right: 0, bottom: 0, left: 0}}}>
                <TuneInScreen/>
            </SafeAreaProvider>
        );

        fireEvent.changeText(screen.getByLabelText('TuneIn search'), '94,3');
        await waitFor(() => expect(screen.getByLabelText('Search TuneIn')).not.toBeDisabled());
        fireEvent.press(screen.getByLabelText('Search TuneIn'));
        const station = await screen.findAllByLabelText('Select 94,3 RS2');
        fireEvent.press(station[0]);

        await waitFor(() => expect(mockBack).toHaveBeenCalled());
        expect(keyboardDismissSpy).toHaveBeenCalled();
        expect(global.fetch).toHaveBeenCalledWith('http://azsound.home.spengler.berlin:8000/api/control/devices/192.168.1.187/providers/tunein/play', expect.objectContaining({
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({location: '/v1/playback/station/a128828', type: 'stationurl', name: '94,3 RS2', containerArt: ''})
        }));
    });
    it('browses TuneIn categories on the targeted device', async () => {
        const screen = render(
            <SafeAreaProvider initialMetrics={{frame: {x: 0, y: 0, width: 320, height: 640}, insets: {top: 0, right: 0, bottom: 0, left: 0}}}>
                <TuneInScreen/>
            </SafeAreaProvider>
        );

        await waitFor(() => expect(screen.getByLabelText('Browse TuneIn')).not.toBeDisabled());
        fireEvent.press(screen.getByLabelText('Browse TuneIn'));

        expect(await screen.findByText('Local Radio')).toBeTruthy();
        expect(screen.getByText('Music')).toBeTruthy();
        expect(global.fetch).toHaveBeenCalledWith('http://azsound.home.spengler.berlin:8000/api/control/providers/tunein/navigate', undefined);

        fireEvent.press(screen.getByLabelText('Browse Local Radio'));
        await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
            'http://azsound.home.spengler.berlin:8000/api/control/providers/tunein/navigate/aHR0cDovL29wbWwucmFkaW90aW1lLmNvbS9Ccm93c2UuYXNoeD9jPWxvY2FsJnJlbmRlcj1qc29u',
            undefined
        ));
        fireEvent.press(screen.getByLabelText('Back to Local Radio'));
        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
        expect(screen.getByText('Local Radio')).toBeTruthy();
    });

});
