import NeuralTerminal from '../lullaby.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';

export default function App() {
  return (
    <ErrorBoundary>
      <NeuralTerminal />
    </ErrorBoundary>
  );
}
