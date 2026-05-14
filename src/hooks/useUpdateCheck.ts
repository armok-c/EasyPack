import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";

interface UpdateCheckResult {
  has_update: boolean;
  latest_version: string | null;
}

export function useUpdateCheck(storeReady: boolean) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState("");

  useEffect(() => {
    if (!storeReady) return;
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
  }, [storeReady]);

  async function checkNow(): Promise<boolean> {
    try {
      const version = await getVersion();
      setCurrentVersion(version);

      const result = await invoke<UpdateCheckResult>("check_for_updates");
      setUpdateAvailable(result.has_update);
      setLatestVersion(result.latest_version);
      return true;
    } catch {
      return false;
    }
  }

  async function openReleasePage() {
    try {
      await invoke("open_release_page");
    } catch {
      // Silent fail
    }
  }

  return { updateAvailable, latestVersion, currentVersion, openReleasePage, checkNow };
}
