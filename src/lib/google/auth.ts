import "server-only";

import { google } from "googleapis";
import type { GoogleConfig } from "./config";

/**
 * Klien Google yang dipakai di server.
 *
 * Satu JWT per scope set. Tidak ada kredensial yang bocor ke bundle browser
 * karena semua modul di folder ini dijaga `server-only` dan hanya diimpor dari
 * Route Handler.
 */

export type GoogleClients = {
  drive: ReturnType<typeof google.drive>;
  sheets: ReturnType<typeof google.sheets>;
};

function createAuth(config: GoogleConfig, scopes: string[]) {
  return new google.auth.JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes,
  });
}

export function createGoogleClients(config: GoogleConfig): GoogleClients {
  const driveAuth = createAuth(config, config.driveScopes);
  const sheetsAuth = createAuth(config, config.sheetsScopes);

  return {
    drive: google.drive({ version: "v3", auth: driveAuth }),
    sheets: google.sheets({ version: "v4", auth: sheetsAuth }),
  };
}
