/**
 * Expo entry component shared by web and native.
 * The M2 status screen starts the app-owned game loop and persistence runtime.
 */
import TerminalScreen from './src/ui/TerminalScreen';

export default function App() {
  return <TerminalScreen />;
}
