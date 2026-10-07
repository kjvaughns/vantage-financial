const SITE = "https://vantage-financial.net";
const IMAGE = `${SITE}/vantage-og.png`;

/** Shared social/search tags for a public page: self-referencing URL plus the logo share image. */
export function seoMeta(path: string) {
  return [
    { property: "og:url", content: `${SITE}${path}` },
    { property: "og:site_name", content: "Vantage Financial" },
    { property: "og:image", content: IMAGE },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Vantage Financial logo" },
    { name: "twitter:image", content: IMAGE },
  ];
}

export function seoLinks(path: string) {
  return [{ rel: "canonical", href: `${SITE}${path}` }];
}
