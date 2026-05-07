import type { ReactNode } from "react";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";
import {
  Cpu,
  Home as HomeIcon,
  Code2,
  Layers,
  Zap,
  BookOpen,
  ExternalLink,
  ArrowRight,
  Radio,
  History
} from "lucide-react";

import styles from "./index.module.css";

const advantages = [
  {
    icon: Cpu,
    title: "Runs on commercially available boards",
    description:
      "uni-gtw runs on many ESP32 (ESP32-C3, ESP32-S3) boards with the SX1262 or CC1101 radio modules. They can by purchased on Aliexpress or Allegro at 10x less than the first party COSMO | GTW gateway. ",
  },
  {
    icon: HomeIcon,
    title: "Fully local and open",
    description:
      "The gateway natively connects to a MQTT broker via the local network and automatically integrates with Home Assistant. No cloud services or internet connection is required for operation.",
  },
  {
    icon: History,
    title: "Supports older blinds",
    description:
      "The gateway can control devices manufactured before 2017, which use the older COSMO protocol. This is another advantage over the official gateway.",
  },
];

const gettingStartedLinks = [
  {
    icon: Layers,
    title: "Supported boards",
    description:
      "See the supported hardware for running uni-gtw.",
    to: "/docs/installation/supported_boards",
  },
  {
    icon: Zap,
    title: "Installation",
    description:
      "Install the firmware onto your board using the web flasher.",
    to: "/docs/installation/flashing_firmware",
  },
  {
    icon: BookOpen,
    title: "Usage",
    description:
      "Pairing your blinds with the gateway and enabling the MQTT integration.",
    to: "/docs/usage/pairing_devices",
  },
];

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();

  return (
    <Layout
      title="Homepage"
      description="Documentation for the uni-gtw project, an ESP32-based RF gateway for Mobilus COSMO devices."
    >
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <Heading as="h1" className={styles.heroTitle}>
              {siteConfig.title}
            </Heading>
            <p className={styles.heroDescription}>
              Unofficial open-source ESP32 firmware for controlling blinds and devices manufactured by Mobilus sp. z o. o. compatible with the the Mobilus COSMO 868 Mhz RF protocol.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryAction} to="/docs/intro">
                <BookOpen size={16} />
                Documentation
              </Link>
              <Link
                className={styles.secondaryAction}
                to="https://github.com/alufers/uni-gtw"
              >
                <ExternalLink size={16} />
                Source code
              </Link>
            </div>
          </div>

          {/* <div className={styles.heroVisual} aria-label="Hardware preview area">
            <div className={styles.hardwareFrame}>
              <div className={styles.hardwareBadge}><Radio size={13} />Hardware preview</div>
              <div className={styles.hardwareStage}>
                <div className={styles.deviceBoard} />
                <div className={styles.deviceModule} />
                <div className={styles.deviceAntenna} />
                <div className={styles.deviceShadow} />
              </div>
              <p className={styles.hardwareHint}>
                This panel is ready for your transparent hardware image.
              </p>
            </div>
          </div> */}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>Why uni-gtw</p>
            <Heading as="h2" className={styles.sectionTitle}>
              A cheap and easy way to integrate your blinds into Home Assistant
            </Heading>
          </div>
          <div className={styles.advantagesGrid}>
            {advantages.map((advantage) => (
              <article key={advantage.title} className={styles.infoCard}>
                <div className={styles.cardIconWrap}>
                  <advantage.icon size={20} />
                </div>
                <Heading as="h3" className={styles.cardTitle}>
                  {advantage.title}
                </Heading>
                <p className={styles.cardText}>{advantage.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>Getting started</p>
            <Heading as="h2" className={styles.sectionTitle}>
              Consult the manual pages listed below.
            </Heading>
          </div>
          <div className={styles.gettingStartedGrid}>
            {gettingStartedLinks.map((item) => (
              <Link key={item.title} className={styles.gettingStartedCard} to={item.to}>
                <div className={styles.cardIconWrap}>
                  <item.icon size={20} />
                </div>
                <Heading as="h3" className={styles.cardTitle}>
                  {item.title}
                </Heading>
                <p className={styles.cardText}>{item.description}</p>
                <span className={styles.cardAction}>
                  Open guide
                  <ArrowRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </Layout>
  );
}
