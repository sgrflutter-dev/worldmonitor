import { getConfiguredWebApiBaseUrl, getDeployBasePath } from '@/services/runtime';

export function getRpcBaseUrl(): string {
  // Desktop keeps a relative base so installRuntimeFetchPatch() can resolve the
  // latest sidecar port per request instead of freezing a stale module-load port.
  // (getDeployBasePath() is "" on desktop, so this stays relative there.)
  //
  // When no remote API base is configured (self-hosted / sub-path deploy), honor
  // the deployment base path so generated RPC clients emit e.g.
  // "/monitor/api/<domain>/v1/..." instead of leaking to the absolute "/api/..."
  // of whichever app owns the root host. No-op when base is "/".
  return getConfiguredWebApiBaseUrl() || getDeployBasePath();
}
