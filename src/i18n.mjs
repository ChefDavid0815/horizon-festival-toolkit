import en from "./locales/en.json";
import v2 from './locales/v2.en.json';
import v3 from './locales/v3.en.json';
import v4 from './locales/v4.en.json';
export function translate(locale, key, values = {}) {
  let text = locale === "en" ? (v4[key] ?? v3[key] ?? v2[key] ?? en[key] ?? key) : ({Yellow:'黄色',Orange:'橙色',Green:'绿色',Blue:'蓝色',Purple:'紫色',Pink:'粉色',Gold:'金色'}[key]??key);
  if (locale === "en" && text.startsWith("统计字段未匹配: "))
    text =
      "Statistics field not found: " + text.slice("统计字段未匹配: ".length);
  if(locale==='en') for(const [prefix,replacement] of [['缺少车库字段 ','Missing garage field: '],['未适配的必填车库字段: ','Unsupported required garage field: '],['调校参数无效: ','Invalid tuning value: '],['非目标字段发生变化: ','A field outside the change changed: '],['社区站点暂时不可用','The community site is unavailable right now ']]) if(text.startsWith(prefix))text=replacement+text.slice(prefix.length);
  return text.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
}
export function browserLocale() {
  return /^zh(?:[-_]|$)/i.test(navigator.language) ? "zh" : "en";
}
