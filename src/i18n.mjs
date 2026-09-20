import en from "./locales/en.json";
import v2 from './locales/v2.en.json';
export function translate(locale, key, values = {}) {
  let text = locale === "en" ? (v2[key] ?? en[key] ?? key) : key;
  if (locale === "en" && text.startsWith("统计字段未匹配: "))
    text =
      "Statistics field not found: " + text.slice("统计字段未匹配: ".length);
  if(locale==='en') for(const [prefix,replacement] of [['缺少车库字段 ','Missing garage field: '],['未适配的必填车库字段: ','Unsupported required garage field: ']]) if(text.startsWith(prefix))text=replacement+text.slice(prefix.length);
  return text.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
}
export function browserLocale() {
  return /^zh(?:[-_]|$)/i.test(navigator.language) ? "zh" : "en";
}
