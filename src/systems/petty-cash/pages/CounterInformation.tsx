import CounterPage from "./CounterPage";

interface CounterInformationProps {
  onClose?: () => void;
}

export default function CounterInformation({ onClose }: CounterInformationProps) {
  return <CounterPage onClose={onClose} />;
}
