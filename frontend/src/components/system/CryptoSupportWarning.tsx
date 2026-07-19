"use client";

import { useEffect } from "react";
import { assertWebCryptoSupport } from "@/lib/browserCrypto";

export function CryptoSupportWarning() {
  useEffect(() => {
    assertWebCryptoSupport();
  }, []);

  return null;
}
