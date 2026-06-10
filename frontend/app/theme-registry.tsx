"use client";

import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { useServerInsertedHTML } from "next/navigation";
import * as React from "react";

import theme from "./theme";

type ThemeRegistryProps = {
  children: React.ReactNode;
};

type CacheState = {
  cache: ReturnType<typeof createCache>;
  flush: () => Record<string, string | true>;
};

export default function ThemeRegistry({ children }: ThemeRegistryProps) {
  const [{ cache, flush }] = React.useState<CacheState>(() => {
    const cache = createCache({ key: "css", prepend: true });
    cache.compat = true;
    const flush = () => {
      const inserted = cache.inserted;
      cache.inserted = {};
      const filtered: Record<string, string | true> = {};
      for (const [key, value] of Object.entries(inserted)) {
        if (typeof value === "string" || value === true) {
          filtered[key] = value;
        }
      }
      return filtered;
    };
    return { cache, flush };
  });

  useServerInsertedHTML(() => {
    const inserted = flush();
    const names = Object.keys(inserted);
    if (names.length === 0) {
      return null;
    }
    let styles = "";
    for (const name of names) {
      const style = inserted[name];
      if (typeof style === "string") {
        styles += style;
      }
    }
    return (
      <style
        data-emotion={`${cache.key} ${names.join(" ")}`}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: required by Emotion SSR cache injection (MUI App Router setup)
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
}
