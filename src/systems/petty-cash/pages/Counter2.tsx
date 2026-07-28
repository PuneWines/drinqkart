import CounterPage from "./CounterPage";

interface Counter2Props {
  onClose?: () => void;
}

export default function Counter2({ onClose }: Counter2Props) {
  return <CounterPage counter={2} onClose={onClose} />;
}
