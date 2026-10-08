import fs from "node:fs";
import path from "node:path";
import type { LoadContext, Plugin } from "@docusaurus/types";
import type {
  DocMetadata,
  LoadedContent,
  LoadedVersion,
} from "@docusaurus/plugin-content-docs";

const DOCS_PLUGIN_NAME = "docusaurus-plugin-content-docs";
const MAX_SUMMARY_LENGTH = 240;

type SidebarItem = LoadedVersion["sidebars"][string][number];

function cleanMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstParagraph(source: string): string {
  const withoutFrontMatter = source.replace(
    /^---\r?\n[\s\S]*?\r?\n---\r?\n/,
    "",
  );
  for (const block of withoutFrontMatter.split(/\r?\n\s*\r?\n/)) {
    const lines = block
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(
        (line) =>
          line.length > 0 &&
          !line.startsWith("#") &&
          !line.startsWith("import ") &&
          !line.startsWith("export ") &&
          !line.startsWith("|") &&
          !line.startsWith(":::"),
      );
    const text = cleanMarkdown(lines.join(" "));
    if (text.length > 0) {
      return text;
    }
  }
  return "";
}

function truncateSummary(text: string): string {
  if (text.length <= MAX_SUMMARY_LENGTH) {
    return text;
  }
  const sentence = text.slice(0, MAX_SUMMARY_LENGTH).match(/^.*?[.!?](?=\s|$)/);
  if (sentence) {
    return sentence[0];
  }
  const cutoff = text.lastIndexOf(" ", MAX_SUMMARY_LENGTH);
  return `${text.slice(0, cutoff > 0 ? cutoff : MAX_SUMMARY_LENGTH)}…`;
}

function summarize(doc: DocMetadata, siteDir: string): string {
  const explicit = doc.frontMatter.description;
  if (explicit) {
    return truncateSummary(cleanMarkdown(explicit));
  }
  const sourcePath = path.join(siteDir, doc.source.replace(/^@site\//, ""));
  try {
    return truncateSummary(firstParagraph(fs.readFileSync(sourcePath, "utf8")));
  } catch {
    return "";
  }
}

function collectDocIds(items: SidebarItem[], docIds: string[]): void {
  for (const item of items) {
    if (item.type === "doc" || item.type === "ref") {
      docIds.push(item.id);
    } else if (item.type === "category") {
      if (item.link?.type === "doc") {
        docIds.push(item.link.id);
      }
      collectDocIds(item.items, docIds);
    }
  }
}

function orderDocs(version: LoadedVersion): DocMetadata[] {
  const byId = new Map(version.docs.map((doc) => [doc.id, doc]));
  const orderedIds: string[] = [];
  for (const sidebar of Object.values(version.sidebars)) {
    collectDocIds(sidebar, orderedIds);
  }

  const seen = new Set<string>();
  const ordered: DocMetadata[] = [];
  for (const id of orderedIds) {
    const doc = byId.get(id);
    if (doc && !seen.has(doc.id)) {
      seen.add(doc.id);
      ordered.push(doc);
    }
  }
  const remaining = version.docs
    .filter((doc) => !seen.has(doc.id))
    .sort((a, b) => a.title.localeCompare(b.title));
  return [...ordered, ...remaining];
}

export default function llmsTxtPlugin(context: LoadContext): Plugin {
  let docs: DocMetadata[] = [];

  return {
    name: "llms-txt",

    allContentLoaded({ allContent }) {
      const content = allContent[DOCS_PLUGIN_NAME]?.default as
        | LoadedContent
        | undefined;
      const version = content?.loadedVersions[0];
      docs = version ? orderDocs(version) : [];
    },

    postBuild({ outDir }) {
      const { title, tagline, url, baseUrl } = context.siteConfig;
      const listed = docs.filter((doc) => !doc.unlisted && !doc.draft);

      const lines = [`# ${title}`, ""];
      if (tagline) {
        lines.push(`> ${tagline}`, "");
      }
      lines.push("## Docs", "");
      for (const doc of listed) {
        const href = `${url}${doc.permalink}`;
        const summary = summarize(doc, context.siteDir);
        lines.push(
          summary
            ? `- [${doc.title}](${href}): ${summary}`
            : `- [${doc.title}](${href})`,
        );
      }
      lines.push("", "## Optional", "");
      lines.push(`- [Blog](${url}${baseUrl}blog)`);
      lines.push("- [GitHub](https://github.com/asbplayer/asbplayer)");
      lines.push("");

      fs.writeFileSync(path.join(outDir, "llms.txt"), lines.join("\n"));
    },
  };
}
