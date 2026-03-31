# Security Policy

## Reporting a Vulnerability

**Please do NOT file a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in a11y-ai, please report it responsibly:

1. **Email**: Send details to the repository maintainer via GitHub's private vulnerability reporting feature
2. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes (optional)

We will acknowledge receipt within 72 hours and aim to:

- Confirm the vulnerability within 7 days
- Release a patch for critical issues within 14 days
- Credit you in the release notes (unless you prefer to remain anonymous)

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | ✅ Current release |
| < 0.1   | ❌ Not supported   |

## Security Considerations

### API Key Handling

- **Storage**: API keys are passed directly to AI providers and are never logged, cached, or persisted by a11y-ai
- **Transmission**: Keys are sent over HTTPS to provider APIs
- **Best practices**:
  - Use environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`)
  - Never commit API keys to version control
  - Use secrets management in CI/CD (e.g., GitHub Secrets)

### HTML Input Security

- **Data sent to AI**: When using AI-powered rules (`standard` or `thorough` presets), HTML snippets and element metadata are sent to the configured AI provider
- **Sensitive data**: Do not submit HTML containing:
  - Credentials or authentication tokens
  - Personally Identifiable Information (PII)
  - Internal/private URLs or endpoints
  - Session data or cookies
- **Local processing**: Use `--preset quick` to run audits without any AI calls

### URL Auditing & SSRF Protection

- **Protocol validation**: Only `http://` and `https://` URLs are accepted
- **Private IP blocking**: The auditor blocks requests to:
  - `localhost` and `127.0.0.1`
  - Private IP ranges (`10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`)
  - Link-local addresses (`169.254.x.x`)
- **DNS rebinding**: Be aware that DNS rebinding attacks may still be possible in some configurations

### Dependencies

- **axe-core**: We use axe-core for static accessibility checks. Keep dependencies updated.
- **AI providers**: We rely on official SDKs or direct API calls to OpenAI, Anthropic, and Ollama
- **Audit**: Run `pnpm audit` regularly to check for known vulnerabilities

### GitHub Action Security

- **Token permissions**: The GitHub Action requests only necessary permissions
- **SARIF uploads**: SARIF reports uploaded to GitHub Security do not contain sensitive data
- **PR comments**: Comments are posted using the provided `GITHUB_TOKEN`

## Security Best Practices for Users

### CLI Usage

```bash
# Use environment variables for API keys
export OPENAI_API_KEY=sk-...
npx @a11y-ai/cli audit https://example.com

# For sensitive internal sites, use quick preset (no AI)
npx @a11y-ai/cli audit https://internal.company.com --preset quick

# Or use a local AI provider
npx @a11y-ai/cli audit https://internal.company.com --provider ollama
```

### CI/CD Integration

```yaml
# GitHub Actions - use secrets
- name: Audit
  uses: vudayagirivaibhav/a11y-ai@v0.1.0
  with:
    url: ${{ secrets.STAGING_URL }}
    api-key: ${{ secrets.OPENAI_API_KEY }}
```

### Programmatic Usage

```typescript
import { audit } from '@a11y-ai/core';

// API key from environment, not hardcoded
const result = await audit(url, {
  preset: 'standard',
  provider: {
    name: 'openai',
    apiKey: process.env.OPENAI_API_KEY, // Never hardcode
  },
});
```

## Vulnerability Disclosure Timeline

| Stage                      | Timeframe                            |
| -------------------------- | ------------------------------------ |
| Initial response           | 72 hours                             |
| Vulnerability confirmation | 7 days                               |
| Patch development          | 14 days (critical) / 30 days (other) |
| Public disclosure          | After patch release                  |

## Contact

For security concerns, use GitHub's private vulnerability reporting feature on this repository.

Thank you for helping keep a11y-ai secure!
