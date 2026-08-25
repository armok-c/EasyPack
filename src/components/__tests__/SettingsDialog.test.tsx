import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, expect, it, vi } from "vitest";
import { SettingsDialog } from "@/components/SettingsDialog";

function renderSettings(onDeleteProfile: (id: string) => Promise<boolean>) {
  return render(
    <SettingsDialog
      open
      onOpenChange={vi.fn()}
      trayEnabled
      onTrayEnabledChange={vi.fn()}
      closeToTray
      onCloseToTrayChange={vi.fn()}
      drawerEnabled={false}
      onDrawerEnabledChange={vi.fn()}
      autostartEnabled={false}
      onAutostartEnabledChange={vi.fn()}
      currentVersion="1.0.0"
      updateAvailable={false}
      latestVersion={null}
      onOpenReleasePage={vi.fn()}
      onCheckNow={vi.fn().mockResolvedValue(true)}
      onOpenShortcutPanel={vi.fn()}
      profileMetas={[
        { id: "profile-a", name: "A", createdAt: 1 },
        { id: "profile-b", name: "B", createdAt: 2 },
      ]}
      activeProfileId="profile-a"
      onSwitchProfile={vi.fn().mockResolvedValue(undefined)}
      onCreateProfile={vi.fn().mockResolvedValue(undefined)}
      onDeleteProfile={onDeleteProfile}
      onRenameProfile={vi.fn().mockResolvedValue(undefined)}
      onImportProfile={vi.fn().mockResolvedValue(undefined)}
      onExportProfile={vi.fn().mockResolvedValue(undefined)}
    />,
  );
}

async function openDeleteConfirmation() {
  fireEvent.click(screen.getByTitle("管理配置"));
  fireEvent.click(screen.getByRole("button", { name: "删除当前配置" }));
  expect(screen.getByText("永久删除当前配置？")).toBeInTheDocument();
}

describe("SettingsDialog deletion confirmation", () => {
  it("keeps the confirmation open when deletion is not executed", async () => {
    const onDeleteProfile = vi.fn().mockResolvedValue(false);
    renderSettings(onDeleteProfile);
    await openDeleteConfirmation();

    fireEvent.click(screen.getByRole("button", { name: "永久删除" }));

    await waitFor(() => expect(onDeleteProfile).toHaveBeenCalledWith("profile-a"));
    expect(screen.getByText("永久删除当前配置？")).toBeInTheDocument();
  });

  it("closes the confirmation only after deletion succeeds", async () => {
    const onDeleteProfile = vi.fn().mockResolvedValue(true);
    renderSettings(onDeleteProfile);
    await openDeleteConfirmation();

    fireEvent.click(screen.getByRole("button", { name: "永久删除" }));

    await waitFor(() => expect(screen.queryByText("永久删除当前配置？")).not.toBeInTheDocument());
  });

  it("keeps the confirmation open when deletion rejects", async () => {
    const onDeleteProfile = vi.fn().mockRejectedValue(new Error("删除失败"));
    renderSettings(onDeleteProfile);
    await openDeleteConfirmation();

    fireEvent.click(screen.getByRole("button", { name: "永久删除" }));

    await waitFor(() => expect(onDeleteProfile).toHaveBeenCalledWith("profile-a"));
    expect(screen.getByText("永久删除当前配置？")).toBeInTheDocument();
  });
});
