"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

export function SpotlightBackground({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tealRef = useRef<HTMLDivElement>(null);
  const purpleRef = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tealRef.current) {
      tealRef.current.style.background =
        `radial-gradient(700px circle at ${x}px ${y}px, rgba(65,197,198,0.14), transparent 50%)`;
    }
    if (purpleRef.current) {
      purpleRef.current.style.background =
        `radial-gradient(500px circle at ${x}px ${y}px, rgba(78,55,140,0.10), transparent 50%)`;
    }
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={cn("relative overflow-hidden", className)}
    >
      <div ref={tealRef} className="pointer-events-none absolute inset-0 z-0 transition-all duration-300" />
      <div ref={purpleRef} className="pointer-events-none absolute inset-0 z-0 transition-all duration-500" />
      {children}
    </div>
  );
}
