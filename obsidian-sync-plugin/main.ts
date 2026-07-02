import { exec, spawn } from "child_process";
import { Plugin } from "obsidian";
import {
  DEFAULT_SETTINGS,
  SyncPluginSettings,
  SyncPluginSettingTab,
} from "./settings";

type SyncStatus = "idle" | "checking" | "dev-testing" | "building" | "pushing" | "success" | "error";

export default class SyncPlugin extends Plugin {
  settings: SyncPluginSettings;
  statusBarEl: HTMLElement;
  status: SyncStatus = "idle";
  resetTimer: ReturnType<typeof setTimeout> | null = null;

  async onload() {
    await this.loadSettings();

    // 状态栏
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass("sync-status-bar");
    this.updateStatusBar("idle");

    // 左侧 ribbon 同步按钮
    this.addRibbonIcon("sync", "同步到 GitHub", () => {
      this.startSync();
    });

    // 命令面板命令（可绑定快捷键）
    this.addCommand({
      id: "sync-to-github",
      name: "同步到 GitHub",
      callback: () => this.startSync(),
    });

    // 设置面板
    this.addSettingTab(new SyncPluginSettingTab(this.app, this));
  }

  onunload() {
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /** 获取工作目录 */
  private getWorkDir(): string {
    if (this.settings.projectPath.trim()) {
      return this.settings.projectPath.trim();
    }
    // 使用 vault 路径
    return (this.app.vault.adapter as any).basePath || ".";
  }

  /** 生成提交信息 */
  private getCommitMessage(): string {
    const now = new Date();
    const date = now.toISOString().split("T")[0];
    const time = now.toTimeString().split(" ")[0].slice(0, 5);
    return this.settings.commitMessage
      .replace("{date}", date)
      .replace("{time}", time);
  }

  /** 去除 ANSI 颜色代码 */
  private stripAnsi(str: string): string {
    return str.replace(
      /[][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~]/g,
      ""
    );
  }

  /** 执行 shell 命令 */
  private execCommand(command: string, cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = this.settings.timeout * 1000;
      exec(command, { cwd, timeout, env: { ...process.env } }, (error, stdout, stderr) => {
        if (error) {
          const errMsg = this.stripAnsi(stderr || stdout || error.message);
          reject(new Error(errMsg));
        } else {
          resolve(this.stripAnsi(stdout.trim()));
        }
      });
    });
  }

  /** 测试 Dev 服务器（启动几秒后不崩溃就认为成功） */
  private testDevServer(cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const waitSeconds = this.settings.devWaitSeconds || 5;
      const parts = this.settings.devCommand.split(/\s+/);
      const cmd = parts[0];
      const args = parts.slice(1);

      const child = spawn(cmd, args, {
        cwd,
        shell: true,
        env: { ...process.env },
      });

      let stderr = "";
      let resolved = false;

      child.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      // 等待指定秒数后，如果没有崩溃就认为成功
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          child.kill();
          resolve();
        }
      }, waitSeconds * 1000);

      child.on("error", (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          reject(new Error(err.message));
        }
      });

      child.on("exit", (code, signal) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          // 如果在等待期间就退出了，说明启动失败
          const errMsg = this.stripAnsi(stderr || `进程退出，code: ${code}`);
          reject(new Error(errMsg));
        }
      });
    });
  }

  /** 更新状态栏 */
  private updateStatusBar(status: SyncStatus, message?: string) {
    this.status = status;
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }

    switch (status) {
      case "idle":
        this.statusBarEl.setText("🔄 同步");
        this.statusBarEl.removeClass("sync-building", "sync-success", "sync-error");
        break;
      case "checking":
        this.statusBarEl.setText("🔍 检查中...");
        this.statusBarEl.addClass("sync-building");
        this.statusBarEl.removeClass("sync-success", "sync-error");
        break;
      case "dev-testing":
        this.statusBarEl.setText("🚀 测试启动中...");
        this.statusBarEl.addClass("sync-building");
        this.statusBarEl.removeClass("sync-success", "sync-error");
        break;
      case "building":
        this.statusBarEl.setText("⏳ 构建中...");
        this.statusBarEl.addClass("sync-building");
        this.statusBarEl.removeClass("sync-success", "sync-error");
        break;
      case "pushing":
        this.statusBarEl.setText("⬆️ 推送中...");
        this.statusBarEl.addClass("sync-building");
        this.statusBarEl.removeClass("sync-success", "sync-error");
        break;
      case "success":
        this.statusBarEl.setText("✅ 同步完成");
        this.statusBarEl.addClass("sync-success");
        this.statusBarEl.removeClass("sync-building", "sync-error");
        this.resetTimer = setTimeout(() => this.updateStatusBar("idle"), 5000);
        break;
      case "error":
        this.statusBarEl.setText(`❌ ${message || "失败"}`);
        this.statusBarEl.addClass("sync-error");
        this.statusBarEl.removeClass("sync-building", "sync-success");
        this.resetTimer = setTimeout(() => this.updateStatusBar("idle"), 8000);
        break;
    }
  }

  /** 开始同步 */
  async startSync() {
    if (this.status !== "idle") {
      return;
    }

    const cwd = this.getWorkDir();
    const commitMsg = this.getCommitMessage();

    // Step 1: 执行检查命令（如果启用）
    if (this.settings.enableCheck && this.settings.checkCommand.trim()) {
      this.updateStatusBar("checking");
      try {
        const checkOutput = await this.execCommand(this.settings.checkCommand, cwd);
        console.log("[Sync] Check output:", checkOutput);
      } catch (err: any) {
        const errMsg = err.message?.slice(0, 100) || "检查失败";
        console.error("[Sync] Check failed:", err);
        if (this.settings.continueOnCheckFail) {
          console.log("[Sync] Check failed but continueOnCheckFail is enabled, continuing...");
        } else {
          this.updateStatusBar("error", `检查失败: ${errMsg}`);
          return;
        }
      }
    }

    // Step 2: Dev 测试（如果启用）
    if (this.settings.enableDev && this.settings.devCommand.trim()) {
      this.updateStatusBar("dev-testing");
      try {
        await this.testDevServer(cwd);
        console.log("[Sync] Dev test passed");
      } catch (err: any) {
        const errMsg = err.message?.slice(0, 100) || "启动失败";
        console.error("[Sync] Dev test failed:", err);
        this.updateStatusBar("error", `启动失败: ${errMsg}`);
        return;
      }
    }

    // Step 3: 执行构建命令（如果启用）
    if (this.settings.enableBuild && this.settings.buildCommand.trim()) {
      this.updateStatusBar("building");
      try {
        const buildOutput = await this.execCommand(this.settings.buildCommand, cwd);
        console.log("[Sync] Build output:", buildOutput);
      } catch (err: any) {
        const errMsg = err.message?.slice(0, 100) || "构建失败";
        console.error("[Sync] Build failed:", err);
        this.updateStatusBar("error", `构建失败: ${errMsg}`);
        return;
      }
    }

    // Step 4: Git add + commit
    this.updateStatusBar("pushing");
    try {
      await this.execCommand("git add -A", cwd);
      await this.execCommand(`git commit -m "${commitMsg}"`, cwd);
    } catch (err: any) {
      // commit 可能因为没有变更而失败，这是正常的
      const msg = err.message || "";
      if (msg.includes("nothing to commit") || msg.includes("no changes added")) {
        this.updateStatusBar("success");
        return;
      }
      console.error("[Sync] Git commit failed:", err);
      this.updateStatusBar("error", `提交失败: ${msg.slice(0, 80)}`);
      return;
    }

    // Step 4: Git push（如果启用）
    if (this.settings.autoPush) {
      try {
        await this.execCommand("git push", cwd);
      } catch (err: any) {
        const errMsg = err.message?.slice(0, 100) || "推送失败";
        console.error("[Sync] Git push failed:", err);
        this.updateStatusBar("error", `推送失败: ${errMsg}`);
        return;
      }
    }

    // 完成
    this.updateStatusBar("success");
  }
}
