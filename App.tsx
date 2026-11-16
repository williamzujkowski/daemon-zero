/**
 * Expo entry component shared by web and native.
 * The M2 status screen starts the app-owned game loop and persistence runtime.
 */
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import TerminalScreen from './src/ui/TerminalScreen';
import { ZERO_METRICS } from './src/ui/safeArea';

export default function App() {
  // Native supplies real metrics synchronously; web has none until the provider measures.
  return <SafeAreaProvider initialMetrics={initialWindowMetrics ?? ZERO_METRICS}><TerminalScreen /></SafeAreaProvider>;
}
