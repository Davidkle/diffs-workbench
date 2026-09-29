import * as Menu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
export function Dropdown({
  trigger,
  items,
}: {
  trigger: ReactNode;
  items: {
    label: string;
    onSelect: () => void;
    danger?: boolean;
    disabled?: boolean;
  }[];
}) {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          sideOffset={5}
          className="z-50 min-w-44 rounded-lg border border-white/10 bg-[#171717] p-1 shadow-xl"
        >
          {items.map((item, i) => (
            <Menu.Item
              key={i}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={`cursor-pointer rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-white/10 data-[disabled]:opacity-30 ${item.danger ? "text-red-300" : "text-zinc-200"}`}
            >
              {item.label}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
