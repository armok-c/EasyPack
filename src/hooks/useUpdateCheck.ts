import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import type { Store } from "@tauri-apps/plugin-store";

interface UpdateCheckResult {
  has_update: boolean;
  latest_version: string | null;
}

export function useUpdateCheck(store: Store | null) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState("");

  useEffect(() => {
    if (!store) return;
    let mounted = true;

    async function check() {
      try {
        const version = await getVersion();
        if (!mounted) return;
        setCurrentVersion(version);

        const result = await invoke<UpdateCheckResult>("check_for_updates");
        if (!mounted) return;
        setUpdateAvailable(result.has_update);
        setLatestVersion(result.latest_version);
      } catch {
        // Silent fail — network errors should not disrupt UX
      }
    }

    check();
    return () => { mounted = false; };
  }, [store]);

  async function openReleasePage() {
    try {
      await invoke("open_release_page");
    } catch {
      // Silent fail
    }
  }

  return { updateAvailable, latestVersion, currentVersion, openReleasePage };
}
