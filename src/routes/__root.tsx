import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Link,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";

// Meta (Facebook) Pixel — loads site-wide on every page.
// Pixel ID 929825575167366 is a publishable tracking ID, safe in client code.
const META_PIXEL_CODE = `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '929825575167366');
fbq('track', 'PageView');`;

// No-JS fallback tracking pixel, rendered in <body>.
const META_PIXEL_NOSCRIPT =
  '<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=929825575167366&ev=PageView&noscript=1" /></noscript>';

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-vantage-ivory">
      <div className="max-w-md text-center">
        <h1 className="font-display text-[96px] leading-none text-vantage-gold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-vantage-muted">This page doesn't exist or has moved.</p>
        <div className="mt-6">
          <Link to="/" className="vantage-btn-primary px-5 py-3 text-sm">
            Return to Vantage
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-vantage-ivory">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-vantage-muted">Try again, or head back to Vantage.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="vantage-btn-primary px-5 py-3 text-sm"
          >
            Try again
          </button>
          <a href="/" className="vantage-btn-ghost px-5 py-3 text-sm">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Vantage Financial — Build your empire in insurance sales" },
      {
        name: "description",
        content:
          "Uncapped commissions with daily pay, unlimited leads, and discounted licensing and training. Join the Vantage Financial recruiting team.",
      },
      { name: "author", content: "Vantage Financial" },
      { property: "og:title", content: "Vantage Financial" },
      {
        property: "og:description",
        content: "Build your empire in insurance sales — uncapped commissions with daily pay, unlimited leads, and discounted licensing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },

      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
    scripts: [
      {
        tag: "script",
        attrs: {},
        children: META_PIXEL_CODE,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <div dangerouslySetInnerHTML={{ __html: META_PIXEL_NOSCRIPT }} />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
