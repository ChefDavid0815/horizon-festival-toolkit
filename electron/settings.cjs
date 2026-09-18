const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
function resolveLocale(preference, system) {
  return preference === "zh" || preference === "en"
    ? preference
    : /^zh(?:[-_]|$)/i.test(system || "")
      ? "zh"
      : "en";
}
class Preferences {
  constructor(directory, systemLanguage) {
    this.file = path.join(directory, "settings.json");
    this.systemLanguage = systemLanguage;
    this.preference = "system";
  }
  async init() {
    try {
      const saved = JSON.parse(await fs.readFile(this.file, "utf8"));
      if (["system", "zh", "en"].includes(saved.language))
        this.preference = saved.language;
    } catch {}
    return this.current();
  }
  current() {
    const system = this.systemLanguage();
    return {
      preference: this.preference,
      system,
      locale: resolveLocale(this.preference, system),
    };
  }
  async setLanguage(value) {
    if (!["system", "zh", "en"].includes(value)) throw Error("无效语言设置");
    const temp = this.file + "." + randomUUID() + ".tmp";
    try {
      await fs.writeFile(temp, JSON.stringify({ language: value }, null, 2), {
        flag: "wx",
      });
      await fs.rename(temp, this.file);
    } catch (e) {
      await fs.rm(temp, { force: true });
      throw e;
    }
    this.preference = value;
    return this.current();
  }
}
module.exports = { Preferences, resolveLocale };
