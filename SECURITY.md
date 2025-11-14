# Security Policy

## Supported Versions

Currently supported versions for security updates:

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| < 2.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability within TachiBot MCP, please follow these steps:

### How to Report

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. Instead, please report vulnerabilities via:
   - Email: `tachibotmcp [at] gmail [dot] com`
   - GitHub Security Advisory: [Report a vulnerability](https://github.com/pavveu/tachibot-mcp/security/advisories/new)

### What to Include

Please provide:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- Acknowledgment: Within 48 hours
- Initial assessment: Within 1 week
- Fix timeline: Depends on severity

## Security Best Practices

When using TachiBot MCP:

### API Key Management
- **Never** commit API keys to version control
- Always use `.env` files for sensitive data
- Keep `.env` in `.gitignore`
- Rotate API keys regularly
- Use minimal required permissions for API keys

### Environment Variables
- All sensitive data should be in environment variables
- Never hardcode credentials in source code
- Review `.env.example` for required variables

### Dependencies
- Keep dependencies updated
- Run `npm audit` regularly
- Fix vulnerabilities with `npm audit fix`

### MCP Server Security
- Only install MCP servers from trusted sources
- Review server permissions before installation
- Understand what data servers can access

## Known Security Considerations

### API Key Exposure
- TachiBot MCP requires multiple API keys
- Each key should have minimal required permissions
- Monitor API usage for unusual activity

### Tool Execution
- Tools can make external API calls
- Review tool actions before execution
- Understand cost implications of tool usage

### Data Privacy
- TachiBot may send data to external AI providers
- Review privacy policies of used services
- Don't process sensitive/personal data

## Security Updates

Security updates will be released as:
- Patch versions for minor fixes
- Minor versions for significant security improvements
- Announced in GitHub releases

## Contact

For security-related inquiries:
- Email: `tachibotmcp [at] gmail [dot] com`
- GitHub Security Advisory: [Report a vulnerability](https://github.com/pavveu/tachibot-mcp/security/advisories/new)

## Acknowledgments

We appreciate responsible disclosure of security vulnerabilities and will acknowledge security researchers who help improve TachiBot MCP's security.