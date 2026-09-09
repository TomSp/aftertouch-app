import AsyncStorage from '@react-native-async-storage/async-storage';
import { render } from '@testing-library/react-native';
import devices from '../test-data/setup-devices.json';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from '../src/app/index';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn()
}));

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children
}));

describe('HomeScreen device loading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('http://azsound.home.spengler.berlin:8000');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => devices
    });
  });

  it('renders only devices with a device_serial_number', async () => {
    const screen = render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 320, height: 640 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } }}>
        <HomeScreen />
      </SafeAreaProvider>
    );

    await screen.findByText('EZ SoundTouch');
    expect(screen.getByText('EZ SoundTouch')).toBeTruthy();
    expect(screen.getByText('192.168.1.187')).toBeTruthy();
    expect(screen.getByText('Bose WZ')).toBeTruthy();
    expect(screen.getByText('192.168.1.42')).toBeTruthy();
    expect(screen.getByText('AZ Soundtouch')).toBeTruthy();
    expect(screen.getByText('192.168.1.129')).toBeTruthy();
    expect(screen.queryByText('Bose Keller AZ')).toBeNull();
    expect(screen.queryByText('192.168.1.166')).toBeNull();
    expect(screen.queryByText('SoundTouch-192.168.1.237')).toBeNull();
    expect(screen.queryByText('192.168.1.237')).toBeNull();

    expect(global.fetch).toHaveBeenCalledWith('http://azsound.home.spengler.berlin:8000/setup/devices');
  });
});
