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

  // Split comma-separated numbers into individual clickable elements
  const numbers = phoneNumber.includes(',')
    ? phoneNumber.split(',').map((n) => n.trim()).filter(Boolean)
    : [phoneNumber];

  const disabled = !isConnected || isCallActive;

  if (numbers.length === 1) {
    return (
      <SinglePhone
        number={numbers[0]!}
        personId={personId}
        organizationId={organizationId}
        showIcon={showIcon}
        variant={variant}
        size={size}
        disabled={disabled}
        isConnected={isConnected}
        makeCall={makeCall}
        className={className}
      />
    );
  }

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-1 gap-y-0.5", className)}>
      {showIcon && <Phone className="h-4 w-4 shrink-0" />}
      {numbers.map((num, i) => (
        <span key={`${num}-${i}`} className="inline-flex items-center">
          <SinglePhone
            number={num}
            personId={personId}
            organizationId={organizationId}
            showIcon={false}
            variant={variant}
            size={size}
            disabled={disabled}
            isConnected={isConnected}
            makeCall={makeCall}
          />
          {i < numbers.length - 1 && (
            <span className="text-muted-foreground">,</span>
          )}
        </span>
      ))}
    </span>
  );
}

function SinglePhone({
  number,
  personId,
  organizationId,
  showIcon,
  variant,
  size,
  disabled,
  isConnected,
  makeCall,
  className,
}: {
  number: string;
  personId?: string;
  organizationId?: string;
  showIcon: boolean;
  variant: "link" | "ghost" | "default";
  size: "sm" | "default" | "lg" | "icon";
  disabled: boolean;
  isConnected: boolean;
  makeCall: (number: string, personId?: string, organizationId?: string) => void;
  className?: string;
}) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => {
        if (!disabled) makeCall(number, personId, organizationId);
      }}
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
          : `Call ${number}`
      }
    >
      {showIcon && <Phone className="h-4 w-4" />}
      {number}
    </Button>
  );
}
