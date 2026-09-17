"use client";

import React from "react";
import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast bg-white text-[#1C1917] border border-[#E5DFD5] shadow-md rounded-xl",
          description: "text-[#7A7267]",
          actionButton: "bg-[#806A50] text-[#FFFFFF]",
          cancelButton: "bg-[#EBE5DB] text-[#1C1917]",
        },
      }}
    />
  );
}
