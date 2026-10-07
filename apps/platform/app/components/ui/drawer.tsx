"use client";

import * as React from "react";
import { PeekView } from "./PeekView";

/**
 * Kept for the pages that import it. It used to slide in from the right; it
 * now opens the record in the middle of the screen (PeekView).
 */
interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Drawer({ isOpen, onClose, title, children }: DrawerProps) {
  if (!isOpen) return null;
  return <PeekView title={title} onClose={onClose} size="lg">{children}</PeekView>;
}
