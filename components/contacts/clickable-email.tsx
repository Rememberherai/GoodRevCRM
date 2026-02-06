"use client";

import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ClickableEmailProps {
  email: string | null | undefined;
  onEmailClick: () => void;
  className?: string;
  showIcon?: boolean;
  variant?: "link" | "ghost" | "default";
  size?: "sm" | "default" | "lg" | "icon";
}

export function ClickableEmail({
  email,
  onEmailClick,
  className,
  showIcon = true,
  variant = "link",
  size = "sm",
}: ClickableEmailProps) {
  if (!email) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={onEmailClick}
      className={cn(
        "gap-2 p-0 h-auto font-normal",
        variant === "link" && "text-foreground hover:text-primary hover:underline",
        className
      )}
      title={`Send email to ${email}`}
    >
      {showIcon && <Mail className="h-4 w-4" />}
      {email}
    </Button>
  );
}
