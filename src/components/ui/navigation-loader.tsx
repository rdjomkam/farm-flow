"use client";

import { useEffect } from "react";
import { useGlobalLoading } from "@/contexts/global-loading.context";

export function NavigationLoader() {
  const { increment, decrement } = useGlobalLoading();
  useEffect(() => {
    increment();
    return () => decrement();
  }, [increment, decrement]);
  return null;
}
