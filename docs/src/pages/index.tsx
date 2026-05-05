import type { ReactNode } from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";

import Heading from "@theme/Heading";

import styles from "./index.module.css";

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`Homepage`}
      description="Documentation for the uni-gtw project, which is an ESP32-based gateway compatible with Mobilus COSMO devices."
    >
      <main></main>
    </Layout>
  );
}
