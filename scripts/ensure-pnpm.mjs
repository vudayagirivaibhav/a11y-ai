const userAgent = process.env.npm_config_user_agent ?? '';

// We rely on pnpm workspaces (`workspace:*`), which npm/yarn cannot resolve correctly.
if (!userAgent.includes('pnpm')) {
  // eslint-disable-next-line no-console
  console.error('\nThis repo uses pnpm workspaces.\n');
  // eslint-disable-next-line no-console
  console.error('Use:\n  corepack enable\n  pnpm install\n');
  // eslint-disable-next-line no-console
  console.error('Do not use `npm install` in this repo (it will fail / produce broken installs).\n');
  process.exit(1);
}

