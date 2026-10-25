import project from "../project.json";
import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: project.names.short,
  tagline: "Learn languages with subtitles",
  favicon: "img/favicon.ico",
  url: project.urls.docs,
  baseUrl: "/",
  organizationName: "asbplayer",
  projectName: "asbplayer-docs",

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  plugins: ["./plugins/llms-txt.ts"],

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          sidebarCollapsed: false,
          editUrl: `${project.urls.repo}/edit/main`,
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ["rss", "atom"],
            xslt: true,
          },
          onInlineTags: "warn",
          onInlineAuthors: "warn",
          onUntruncatedBlogPosts: "warn",
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: "dark",
      disableSwitch: false,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: project.names.short,
      logo: {
        alt: `${project.names.short} logo`,
        src: "img/logo.png",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "User Guide",
          to: "/docs/intro",
        },
        { to: "/blog", label: "Blog", position: "left" },
        {
          href: project.urls.repo,
          className: "header-github-link",
          position: "right",
          "aria-label": "GitHub repository",
        },
        {
          href: project.urls.discord,
          className: "header-discord-link",
          position: "right",
          "aria-label": "Discord server",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "User Guide",
          items: [
            {
              label: "User Guide",
              to: "/docs/intro",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "Discord",
              href: project.urls.discord,
            },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "GitHub",
              href: project.urls.repo,
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} ${project.names.short} authors. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
  themes: [
    [
      require.resolve("@easyops-cn/docusaurus-search-local"),
      /** @type {import("@easyops-cn/docusaurus-search-local").PluginOptions} */
      {
        // ... Your options.
        // `hashed` is recommended as long-term-cache of index file is possible.
        hashed: true,

        // For Docs using Chinese, it is recomended to set:
        language: ["en"],

        // If you're using `noIndex: true`, set `forceIgnoreNoIndex` to enable local index:
        forceIgnoreNoIndex: true,
      },
    ],
  ],
};

export default config;
