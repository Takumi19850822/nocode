"use client";

import { cn } from "@/lib/utils";
import { useInPageHeader } from "@/components/layout/PageLayout";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "excel";
  size?: "sm" | "md" | "lg";
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  const inHeader = useInPageHeader();

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        inHeader ? "rounded-md" : "rounded-lg",
        {
          "bg-primary text-white hover:bg-primary-hover": variant === "primary",
          "border border-white/30 text-white bg-transparent hover:bg-white/10":
            variant === "secondary" && inHeader,
          "bg-gray-200 text-gray-800 hover:bg-gray-300":
            variant === "secondary" && !inHeader,
          "bg-[#217346] text-white hover:bg-[#185c37]": variant === "excel",
          "border border-red-400/60 text-white bg-red-600/80 hover:bg-red-600":
            variant === "danger" && inHeader,
          "bg-red-600 text-white hover:bg-red-700": variant === "danger" && !inHeader,
          "bg-transparent text-gray-600 hover:bg-gray-100": variant === "ghost" && !inHeader,
          "border border-white/30 text-white bg-transparent hover:bg-white/10":
            variant === "ghost" && inHeader,
          "px-3 py-1.5 text-sm": size === "sm",
          "px-4 py-2 text-sm": size === "md",
          "px-6 py-3 text-base": size === "lg",
        },
        className
      )}
      {...props}
    />
  );
}
