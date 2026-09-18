import en from "./locales/en.json";
export function translate(locale, key, values = {}) {
  let text = locale === "en" ? (en[key] ?? key) : key;
  if (locale === "en" && text.startsWith("统计字段未匹配: "))
    text =
      "Statistics field not found: " + text.slice("统计字段未匹配: ".length);
  return text.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
}
export function browserLocale() {
  return /^zh(?:[-_]|$)/i.test(navigator.language) ? "zh" : "en";
}
