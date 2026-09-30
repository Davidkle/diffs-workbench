// Adapted from Vercel AI Elements (Apache-2.0), retaining the message primitives.
import type { ComponentProps, HTMLAttributes } from "react";
import { memo } from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib";

export function Message({
  from,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { from: "user" | "assistant" }) {
  return (
    <div
      className={cn(
        "group flex w-full min-w-0 flex-col gap-2",
        from === "user" ? "is-user ml-auto" : "is-assistant",
        className,
      )}
      {...props}
    />
  );
}
export function MessageContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("min-w-0 max-w-full text-sm", className)} {...props} />
  );
}
export const MessageResponse = memo(function MessageResponse(
  props: ComponentProps<typeof Streamdown>,
) {
  return <Streamdown {...props} />;
});
