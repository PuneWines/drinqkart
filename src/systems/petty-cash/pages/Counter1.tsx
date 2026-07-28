import CounterPage from "./CounterPage";

interface Counter1Props {
  onClose?: () => void;
}

export default function Counter1({ onClose }: Counter1Props) {
  return <CounterPage counter={1} onClose={onClose} />;
}
