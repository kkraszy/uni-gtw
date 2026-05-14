import { createContext } from "preact";

export interface AuthCtx {
  password: string | null;
  language: string;
  hostname: string;
  chip: string;
  version: string;
  onLogout: () => void;
}

export const AuthContext = createContext<AuthCtx>({
  password: null,
  language: "en",
  hostname: "",
  chip: "",
  version: "",
  onLogout: () => {},
});
