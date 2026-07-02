import { App, PluginSettingTab, Setting } from "obsidian";
import type SyncPlugin from "./main";

export interface SyncPluginSettings {
  /** 项目路径（空则使用 vault 路径） */
  projectPath: string;
  /** 检查命令（轻量，快速） */
  checkCommand: string;
  /** 是否启用检查命令 */
  enableCheck: boolean;
  /** 检查失败时是否继续执行构建 */
  continueOnCheckFail: boolean;
  /** Dev 测试命令 */
  devCommand: string;
  /** 是否启用 Dev 测试 */
  enableDev: boolean;
  /** Dev 启动等待秒数（几秒不崩溃就算成功） */
  devWaitSeconds: number;
  /** 构建命令 */
  buildCommand: string;
  /** 是否启用构建命令（false则只跑检查） */
  enableBuild: boolean;
  /** Git 提交信息模板 */
  commitMessage: string;
  /** 是否自动 push */
  autoPush: boolean;
  /** 命令超时秒数 */
  timeout: number;
}

export const DEFAULT_SETTINGS: SyncPluginSettings = {
  projectPath: "",
  checkCommand: "pnpm check",
  enableCheck: true,
  continueOnCheckFail: true,
  devCommand: "pnpm dev",
  enableDev: false,
  devWaitSeconds: 5,
  buildCommand: "pnpm build",
  enableBuild: true,
  commitMessage: "chore: sync {date} {time}",
  autoPush: true,
  timeout: 300,
};

export class SyncPluginSettingTab extends PluginSettingTab {
  plugin: SyncPlugin;

  constructor(app: App, plugin: SyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Sync to GitHub 设置" });

    // 项目路径
    new Setting(containerEl)
      .setName("项目路径")
      .setDesc("要执行命令的目录路径，留空则使用当前 vault 路径")
      .addText((text) =>
        text
          .setPlaceholder("留空使用 vault 路径")
          .setValue(this.plugin.settings.projectPath)
          .onChange(async (value) => {
            this.plugin.settings.projectPath = value;
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl("h3", { text: "执行流程" });

    // 启用检查命令
    new Setting(containerEl)
      .setName("启用检查命令")
      .setDesc("同步前先执行轻量检查（如 astro check），快速发现格式错误")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableCheck).onChange(async (value) => {
          this.plugin.settings.enableCheck = value;
          await this.plugin.saveSettings();
        })
      );

    // 检查命令
    new Setting(containerEl)
      .setName("检查命令")
      .setDesc("轻量快速的检查命令，推荐 astro check")
      .addText((text) =>
        text
          .setPlaceholder("astro check")
          .setValue(this.plugin.settings.checkCommand)
          .onChange(async (value) => {
            this.plugin.settings.checkCommand = value;
            await this.plugin.saveSettings();
          })
      );

    // 检查失败时继续
    new Setting(containerEl)
      .setName("检查失败时继续")
      .setDesc("即使检查命令报错也继续执行构建和推送（适合项目有已知警告的情况）")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.continueOnCheckFail).onChange(async (value) => {
          this.plugin.settings.continueOnCheckFail = value;
          await this.plugin.saveSettings();
        })
      );

    containerEl.createEl("h3", { text: "Dev 测试" });

    // 启用 Dev 测试
    new Setting(containerEl)
      .setName("启用 Dev 测试")
      .setDesc("同步前先启动 dev 服务器，几秒不崩溃就认为项目正常")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableDev).onChange(async (value) => {
          this.plugin.settings.enableDev = value;
          await this.plugin.saveSettings();
        })
      );

    // Dev 命令
    new Setting(containerEl)
      .setName("Dev 命令")
      .setDesc("启动开发服务器的命令")
      .addText((text) =>
        text
          .setPlaceholder("pnpm dev")
          .setValue(this.plugin.settings.devCommand)
          .onChange(async (value) => {
            this.plugin.settings.devCommand = value;
            await this.plugin.saveSettings();
          })
      );

    // Dev 等待时间
    new Setting(containerEl)
      .setName("Dev 等待秒数")
      .setDesc("启动后等待几秒不崩溃就算成功")
      .addText((text) =>
        text
          .setPlaceholder("5")
          .setValue(String(this.plugin.settings.devWaitSeconds))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num > 0) {
              this.plugin.settings.devWaitSeconds = num;
              await this.plugin.saveSettings();
            }
          })
      );

    // 启用构建命令
    new Setting(containerEl)
      .setName("启用构建命令")
      .setDesc("检查通过后执行完整构建（较慢但更全面），关闭则只跑检查")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableBuild).onChange(async (value) => {
          this.plugin.settings.enableBuild = value;
          await this.plugin.saveSettings();
        })
      );

    // 构建命令
    new Setting(containerEl)
      .setName("构建命令")
      .setDesc("完整构建命令，如 pnpm build")
      .addText((text) =>
        text
          .setPlaceholder("pnpm build")
          .setValue(this.plugin.settings.buildCommand)
          .onChange(async (value) => {
            this.plugin.settings.buildCommand = value;
            await this.plugin.saveSettings();
          })
      );

    // 提交信息
    new Setting(containerEl)
      .setName("提交信息模板")
      .setDesc("支持 {date} 和 {time} 变量")
      .addText((text) =>
        text
          .setPlaceholder("chore: sync {date} {time}")
          .setValue(this.plugin.settings.commitMessage)
          .onChange(async (value) => {
            this.plugin.settings.commitMessage = value;
            await this.plugin.saveSettings();
          })
      );

    // 自动 push
    new Setting(containerEl)
      .setName("自动 Push")
      .setDesc("构建成功后是否自动推送到远程仓库")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoPush).onChange(async (value) => {
          this.plugin.settings.autoPush = value;
          await this.plugin.saveSettings();
        })
      );

    // 超时时间
    new Setting(containerEl)
      .setName("超时时间（秒）")
      .setDesc("命令执行的最大等待时间")
      .addText((text) =>
        text
          .setPlaceholder("300")
          .setValue(String(this.plugin.settings.timeout))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num > 0) {
              this.plugin.settings.timeout = num;
              await this.plugin.saveSettings();
            }
          })
      );
  }
}
