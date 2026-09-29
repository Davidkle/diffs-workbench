import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-[#171717] p-6 shadow-2xl">
          <DialogPrimitive.Title className="text-lg font-semibold">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-2 text-sm leading-relaxed text-zinc-400">
            {description}
          </DialogPrimitive.Description>
          {children}
          <DialogPrimitive.Close
            className="absolute right-4 top-4 rounded p-1 text-zinc-400 hover:bg-white/10"
            aria-label="Close dialog"
          >
            <X size={16} />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
