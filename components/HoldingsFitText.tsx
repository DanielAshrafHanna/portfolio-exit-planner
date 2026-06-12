"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  minSize?: number;
  maxSize?: number;
  title?: string;
};

export function HoldingsFitText({ children, className = "", minSize = 8, maxSize = 12, title }: Props) {
  const textRef = useRef<HTMLSpanElement>(null);
  const slotRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const fit = () => {
      const text = textRef.current;
      const slot = slotRef.current;
      if (!text || !slot) return;
      let size = maxSize;
      text.style.fontSize = `${size}px`;
      while (size > minSize && text.scrollWidth > slot.clientWidth) {
        size -= 0.5;
        text.style.fontSize = `${size}px`;
      }
    };

    fit();
    const observer = new ResizeObserver(fit);
    if (slotRef.current) observer.observe(slotRef.current);
    return () => observer.disconnect();
  }, [children, minSize, maxSize]);

  return (
    <span ref={slotRef} className="holdings-fit-text-slot block min-w-0 max-w-full" title={title}>
      <span
        ref={textRef}
        className={`inline-block max-w-full whitespace-nowrap tabular-nums leading-tight ${className}`}
        style={{ fontSize: maxSize }}
      >
        {children}
      </span>
    </span>
  );
}
