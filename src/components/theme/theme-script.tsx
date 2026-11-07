import { THEME_STORAGE_KEY } from "./constants";

/**
 * Runs synchronously in <head> before first paint, so the page never flashes
 * the wrong theme. It applies the saved preference (or the OS setting) as the
 * `dark` class on <html>, and keeps following the OS while the preference is
 * "system". See node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
 */
const script = `(function(){
var k=${JSON.stringify(THEME_STORAGE_KEY)},d=document.documentElement,m=window.matchMedia("(prefers-color-scheme: dark)");
function pref(){try{return localStorage.getItem(k)||"system"}catch(e){return "system"}}
function apply(){var p=pref(),dark=p==="dark"||(p==="system"&&m.matches);d.classList.toggle("dark",dark);d.style.colorScheme=dark?"dark":"light"}
apply();
m.addEventListener("change",function(){if(pref()==="system")apply()});
})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
