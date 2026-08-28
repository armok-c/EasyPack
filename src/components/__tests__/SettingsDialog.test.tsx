import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, expect, it, vi } from "vitest";
import { SettingsDialog } from "@/components/SettingsDialog";

const { openDialogMock } = vi.hoisted(() => ({ openDialogMock: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: openDialogMock,
  save: vi.fn(),
}));

function renderSettings(
  onDeleteProfile: (id: string) => Promise<boolean>,
  onImportProfile = vi.fn().mockResolvedValue(undefined),
) {
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
      onImportProfile={onImportProfile}
      onExportProfile={vi.fn().mockResolvedValue(undefined)}
    />,
  );
}

async function openDeleteConfirmation() {
  fireEvent.click(screen.getByRole("button", { name: "管理配置" }));
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

describe("SettingsDialog controls", () => {
  it("only shows the current version and adds space below the settings header", () => {
    renderSettings(vi.fn().mockResolvedValue(true));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("max-w-[380px]");
    expect(dialog).not.toHaveClass("pb-8");
    const header = screen
      .getByRole("heading", { name: "设置" })
      .closest('[data-slot="dialog-header"]');
    expect(header).not.toBeNull();
    expect(header).toHaveClass("mb-2");
    const scrollWrapper = Array.from(dialog.children).find((child) => child.classList.contains("overflow-y-auto"));
    const body = scrollWrapper?.children[0];
    expect(body).toHaveClass("pb-4");
    expect(body).not.toHaveClass("py-4");
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
    expect(screen.queryByText("检查更新")).not.toBeInTheDocument();
    expect(screen.queryByText(/发现新版本/)).not.toBeInTheDocument();
  });

  it("gives each switch an accessible name and makes its text row clickable", () => {
    renderSettings(vi.fn().mockResolvedValue(true));
    expect(screen.getByRole("switch", { name: "启用系统托盘" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "关闭时隐藏到托盘" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "开机启动" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "启用边缘抽屉" })).toBeInTheDocument();
  });

  it("uses an in-app confirmation before importing a profile", async () => {
    openDialogMock.mockResolvedValueOnce("C:/profile.json");
    const onImportProfile = vi.fn().mockResolvedValue(undefined);
    render(
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
        onOpenShortcutPanel={vi.fn()}
        profileMetas={[{ id: "profile-a", name: "A", createdAt: 1 }]}
        activeProfileId="profile-a"
        onSwitchProfile={vi.fn().mockResolvedValue(undefined)}
        onCreateProfile={vi.fn().mockResolvedValue(undefined)}
        onDeleteProfile={vi.fn().mockResolvedValue(true)}
        onRenameProfile={vi.fn().mockResolvedValue(undefined)}
        onImportProfile={onImportProfile}
        onExportProfile={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "管理配置" }));
    fireEvent.click(screen.getByRole("button", { name: "导入配置" }));

    await waitFor(() => expect(screen.getByText("确认导入配置？")).toBeInTheDocument());
    expect(onImportProfile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "确认导入" }));
    await waitFor(() => expect(onImportProfile).toHaveBeenCalledWith("C:/profile.json"));
  });

  it("clears the pending import when canceled", async () => {
    openDialogMock.mockResolvedValueOnce("C:/profile.json");
    const onImportProfile = vi.fn().mockResolvedValue(undefined);
    renderSettings(vi.fn().mockResolvedValue(true), onImportProfile);

    fireEvent.click(screen.getByRole("button", { name: "管理配置" }));
    fireEvent.click(screen.getByRole("button", { name: "导入配置" }));
    await waitFor(() => expect(screen.getByText("确认导入配置？")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    await waitFor(() => expect(screen.queryByText("确认导入配置？")).not.toBeInTheDocument());
    expect(onImportProfile).not.toHaveBeenCalled();
  });
});
