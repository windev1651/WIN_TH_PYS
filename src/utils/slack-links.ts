export function getPysAppHomeUrl(): string | null {
  const teamId = process.env.SLACK_TEAM_ID?.trim();
  const appId = process.env.SLACK_APP_ID?.trim();

  if (!teamId || !appId) {
    return null;
  }

  return (
    `slack://app?team=${encodeURIComponent(teamId)}` +
    `&id=${encodeURIComponent(appId)}` +
    "&tab=home"
  );
}
