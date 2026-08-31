import type { Metadata } from "next";
import SeoPageShell from "@/components/seo-page-shell";
import { manychatAlternativePage } from "@/lib/seo-pages";

export const metadata: Metadata = {
  title: "Manychat Alternative for Instagram Comment-to-DM Campaigns",
  description:
    "A focused Manychat alternative for Instagram keyword comments, private replies, tracked links, analytics, and agency client reports.",
  alternates: { canonical: "/manychat-alternative" },
  openGraph: {
    title: "Manychat Alternative for Instagram Comment-to-DM Campaigns",
    description:
      "Use Claude OpenAI for focused Instagram comment-to-DM campaigns. Built for the people, by the people.",
    url: "/manychat-alternative",
  },
};

export default function ManychatAlternativePage() {
  return <SeoPageShell config={manychatAlternativePage} />;
}

