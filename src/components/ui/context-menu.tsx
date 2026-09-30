import * as Menu from "@radix-ui/react-context-menu";
import { Fragment, type ReactNode } from "react";

export type ContextAction = {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  separatorBefore?: boolean;
};
type Props = {
  children: ReactNode;
  items: ContextAction[];
  onOpen: () => void;
};
export function ContextMenu({ children, items, onOpen }: Props) {
  return (
    <Menu.Root
      onOpenChange={(open) => {
        if (open) onOpen();
      }}
    >
      <Menu.Trigger asChild>{children}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          className="z-50 min-w-48 max-h-(--radix-context-menu-content-available-height) overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
          collisionPadding={8}
        >
          {items.map((item, index) => (
            <Fragment key={item.label}>
              {item.separatorBefore && index > 0 && (
                <Menu.Separator className="-mx-1 my-1 h-px bg-border" />
              )}
              <Menu.Item
                disabled={item.disabled}
                onSelect={item.onSelect}
                className="relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              >
                {item.label}
              </Menu.Item>
            </Fragment>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
