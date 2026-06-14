"use client";

import { useEffect } from "react";

export default function AutoPrint() {
  useEffect(() => {
    const timeout = setTimeout(() => window.print(), 600);
    return () => clearTimeout(timeout);
  }, []);

  return null;
}
