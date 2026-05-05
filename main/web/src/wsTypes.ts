import { Channel } from "./channelTypes";

export interface InfoResponse {
  web_password_enabled: boolean;
  language: string;
  web_password_valid?: boolean | null;
  hostname?: string;
  chip?: string;
  app_version?: string;
  app_project_name?: string;
  app_build_time?: string;
  app_build_date?: string;
  app_idf_ver?: string;
  app_elf_sha256?: string;
}

export type RadioStatus = "ok" | "error" | "not_configured";
export type MqttStatus = "unconfigured" | "connecting" | "connected" | "disconnected";

export interface StatusPayload {
  uptime: number;
  time: number;
  wifi_mode: "ap" | "sta";
  wifi_rssi: number | null;
  wifi_ssid: string | null;
  radio_status: RadioStatus;
  mqtt_status: MqttStatus;
}

export interface ScanEntry {
  ssid: string;
  rssi: number;
  auth: number;
}

export interface PacketInfo {
  raw: string;
  valid: boolean;
  serial?: number;
  cmd?: number;
  proto?: "1way" | "2way";
  counter?: number;
  extra_payload?: number;
}

export interface OtaProgressPayload {
  status: "starting" | "downloading" | "done" | "error";
  progress: number | null;
  error: string | null;
}

export type WsMessage =
  | { cmd: "console"; payload: string }
  | { cmd: "channels"; payload: Channel[] }
  | { cmd: "channel_update"; payload: Channel }
  | { cmd: "channel_deleted"; serial: number }
  | { cmd: "status"; payload: StatusPayload }
  | { cmd: "wifi_scan_result"; payload: ScanEntry[] }
  | { cmd: "packet_rx"; payload: PacketInfo }
  | { cmd: "packet_tx"; payload: PacketInfo }
  | { cmd: "ota_progress"; payload: OtaProgressPayload };
