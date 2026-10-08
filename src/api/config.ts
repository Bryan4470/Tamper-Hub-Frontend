export function baseUrl() {
  return (localStorage.getItem("tamper.api") || "/api/v1").replace(/\/$/, "");
}
export function headers(): Record<string, string> {
  const token = sessionStorage.getItem("tamper.token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getToken() {
  return sessionStorage.getItem("tamper.token") || "";
}
export function saveConnection(url: string, token: string) {
  localStorage.setItem("tamper.api", url.replace(/\/$/, ""));
  sessionStorage.setItem("tamper.token", token);
}
