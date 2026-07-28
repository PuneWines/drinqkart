import CounterPage from "./CounterPage";

interface Counter3Props {
  onClose?: () => void;
}

export default function Counter3({ onClose }: Counter3Props) {
  return <CounterPage counter={3} onClose={onClose} />;
}
