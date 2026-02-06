"use client";

import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTelnyx } from "@/providers/telnyx-provider";
import { useCallStore } from "@/stores/call";
import { cn } from "@/lib/utils";

interface ClickablePhoneProps {
  phoneNumber: string | null | undefined;
  personId?: string;
  organizationId?: string;
  className?: string;
  showIcon?: boolean;
  variant?: "link" | "ghost" | "default";
  size?: "sm" | "default" | "lg" | "icon";
}

export function ClickablePhone({
  phoneNumber,
  personId,
  organizationId,
  className,
  showIcon = true,
  variant = "link",
  size = "sm",
}: ClickablePhoneProps) {
  const { makeCall, isConnected } = useTelnyx();
  const callState = useCallStore((s) => s.callState);
  const isCallActive = callState !== 'idle';

  if (!phoneNumber) {
    return <span className="text-muted-foreground">—</span>;
  }

  const handleClick = () => {
    if (!isConnected || isCallActive) {
      return;
    }
    makeCall(phoneNumber, personId, organizationId);
  };

  const disabled = !isConnected || isCallActive;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "gap-2 p-0 h-auto font-normal",
        variant === "link" && "text-foreground hover:text-primary hover:underline",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      title={
        disabled
          ? isConnected
            ? "Call in progress"
            : "Phone not connected"
          : `Call ${phoneNumber}`
      }
    >
      {showIcon && <Phone className="h-4 w-4" />}
      {phoneNumber}
    </Button>
  );
}
