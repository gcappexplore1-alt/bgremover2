import { APP_NAME, LOGO_URL, PARENT_SITE_NAME, PARENT_SITE_URL } from "@/lib/config";

/** Minimal header: logo only. When embedded in WordPress the theme supplies the navigation. */
export function SiteHeader() {
  return (
    <header className="border-b border-line-soft bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center px-4">
        <a href="#/" className="flex items-center" aria-label={`${PARENT_SITE_NAME} home`}>
          <img src={LOGO_URL} alt={`${PARENT_SITE_NAME} logo`} width={150} height={50} className="h-10 w-auto" />
        </a>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-[#152a63] text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <p className="text-lg font-semibold text-white">{PARENT_SITE_NAME}</p>
          <p className="mt-2 text-sm">Need hand-finished results? Our editors offer clipping path, masking, retouching and shadow services.</p>
        </div>
        <div>
          <p className="font-semibold text-white">Useful links</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li>
              <a className="hover:text-white" href={`${PARENT_SITE_URL}/background-removing-services/`}>
                Background removal service
              </a>
            </li>
            <li>
              <a className="hover:text-white" href={`${PARENT_SITE_URL}/clipping-path-services/`}>
                Clipping path service
              </a>
            </li>
            <li>
              <a className="hover:text-white" href={`${PARENT_SITE_URL}/price-list/`}>
                Price list
              </a>
            </li>
            <li>
              <a className="hover:text-white" href={`${PARENT_SITE_URL}/privacy-policy/`}>
                Privacy policy
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-white">Contact</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li>
              <a className="hover:text-white" href="mailto:info@clippingworld.com">
                info@clippingworld.com
              </a>
            </li>
            <li>
              <a className="hover:text-white" href={`${PARENT_SITE_URL}/contact-us/`}>
                Contact us
              </a>
            </li>
            <li>
              <a className="hover:text-white" href="#/help">
                {APP_NAME} help &amp; privacy
              </a>
            </li>
          </ul>
        </div>
      </div>
      <p className="border-t border-white/10 py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {PARENT_SITE_NAME}. {APP_NAME} runs in your browser.
      </p>
    </footer>
  );
}
