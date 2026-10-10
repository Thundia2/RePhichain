import { Toggle } from "../common/UIKit";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

/** Settings toggle — the shared UIKit Toggle (kept for existing imports). */
export function ToggleSwitch({ checked, onChange, label }: Props) {
  return <Toggle checked={checked} onChange={onChange} label={label} />;
}
