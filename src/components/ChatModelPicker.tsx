import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { ChatProvider, ChatProviderInfo } from "@/chat-types";

type Props = {
  providers: ChatProviderInfo[];
  provider: ChatProvider;
  model: string;
  effort: string;
  loading: boolean;
  disabled: boolean;
  onSelect: (provider: ChatProvider, model: string) => void;
  onEffort: (effort: string) => void;
};
export function ChatModelPicker({
  providers,
  provider,
  model,
  effort,
  loading,
  disabled,
  onSelect,
  onEffort,
}: Props) {
  const current = providers
    .find((p) => p.id === provider)
    ?.models.find((m) => m.id === model);
  const label = current?.name || model || "Default";
  const efforts = current?.efforts || [];
  return (
    <div className="chat-model-controls">
      <Menu.Root>
        <Menu.Trigger asChild>
          <button
            type="button"
            className="chat-model-chip"
            aria-label="Select model"
            disabled={disabled}
          >
            {loading ? "Loading models…" : label}
            <ChevronDown size={12} />
          </button>
        </Menu.Trigger>
        <DropdownMenuContent
          side="top"
          align="end"
          sideOffset={8}
          className="chat-model-menu"
        >
          <Menu.Label className="chat-menu-label">Select model</Menu.Label>
          {providers.map((p, i) => (
            <div key={p.id}>
              {i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={!p.available}
                onSelect={() => onSelect(p.id, "")}
              >
                <span>
                  {p.id === "codex" ? "GPT default" : "Claude default"}
                </span>
                {provider === p.id && !model && <Check size={15} />}
              </DropdownMenuItem>
              {p.models.map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  disabled={!p.available}
                  onSelect={() => onSelect(p.id, m.id)}
                >
                  <span>{m.name}</span>
                  {provider === p.id && model === m.id && <Check size={15} />}
                </DropdownMenuItem>
              ))}
            </div>
          ))}
        </DropdownMenuContent>
      </Menu.Root>
      {efforts.length > 0 && (
        <Menu.Root>
          <Menu.Trigger asChild>
            <button
              type="button"
              className="chat-effort-chip"
              aria-label="Select effort"
              disabled={disabled}
            >
              {effort || "Default"}
              <ChevronDown size={11} />
            </button>
          </Menu.Trigger>
          <DropdownMenuContent
            side="top"
            align="end"
            className="chat-effort-menu"
          >
            <Menu.Label className="chat-menu-label">
              Reasoning effort
            </Menu.Label>
            {["", ...efforts].map((value) => (
              <DropdownMenuItem key={value} onSelect={() => onEffort(value)}>
                <span>{value || "Default"}</span>
                {effort === value && <Check size={14} />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </Menu.Root>
      )}
    </div>
  );
}
