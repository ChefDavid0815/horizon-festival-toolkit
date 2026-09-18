import { createContext, useContext } from "react";
import { translate } from "./i18n.mjs";
export const LanguageContext = createContext("zh");
export function useI18n() {
  const locale = useContext(LanguageContext);
  return { locale, t: (key, values) => translate(locale, key, values) };
}
