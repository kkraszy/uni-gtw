import React from "react";
import BrowserOnly from "@docusaurus/BrowserOnly";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { usePluginData } from "@docusaurus/useGlobalData";
import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

interface ReleaseInfo {
  tag: string;
  name: string;
  publishedAt: string;
  prerelease: boolean;
  manifestPath: string;
  releaseUrl: string;
}

// Cast needed because TypeScript doesn't know about this custom web component.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EspInstallButton = "esp-web-install-button" as any;

function FlashPanel({ manifestUrl }: { manifestUrl: string }) {
  return (
    <BrowserOnly fallback={<p>Loading flasher…</p>}>
      {() => {
        // Import registers the custom element; must run client-side only.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("esp-web-tools");
        return <EspInstallButton manifest={manifestUrl} />;
      }}
    </BrowserOnly>
  );
}

export default function FirmwareFlasher(): React.ReactElement {
  const { releases } = usePluginData("firmware-releases-plugin") as {
    releases: ReleaseInfo[];
  };
  const { siteConfig } = useDocusaurusContext();
  // baseUrl already ends with '/', manifestPath has no leading slash
  const baseUrl = siteConfig.baseUrl;

  if (!releases || releases.length === 0) {
    return (
      <p>
        No firmware releases are available yet. Check back after a tagged
        release is built on GitHub.
      </p>
    );
  }

  return (
    <Tabs>
      {releases.map((release, index) => {
        const manifestUrl = `${baseUrl}${release.manifestPath}`;
        const date = new Date(release.publishedAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        return (
          <TabItem
            key={release.tag}
            value={release.tag}
            label={release.tag}
            default={index === 0}
          >
            <p>
              Published: {date}
              {release.prerelease && " (pre-release)"}
              {" · "}
              <a
                href={release.releaseUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Release notes
              </a>
            </p>
            <FlashPanel manifestUrl={manifestUrl} />
          </TabItem>
        );
      })}
    </Tabs>
  );
}
