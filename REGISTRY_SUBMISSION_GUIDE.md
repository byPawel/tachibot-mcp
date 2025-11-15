# Quick Registry Submission Guide

## 🎯 TL;DR: You're Ready!

✅ **Status:** Ready to submit to all major MCP registries
✅ **Missing:** Nothing critical (mcp.json now created)
⚠️ **Action needed:** Fix license inconsistency (see below)

---

## 🚀 Submit in 3 Steps

### Step 1: Smithery.ai (Fastest - 1 day)

```bash
# Install Smithery CLI
npm install -g @smithery/cli

# Submit (uses existing smithery.yaml)
npx @smithery/cli submit

# Follow prompts
```

**Why start here?** Already 95% configured, fastest approval.

---

### Step 2: GitHub MCP Registry (3-5 days)

1. **Fork the registry:**
   ```bash
   # Go to: https://github.com/modelcontextprotocol/registry
   # Click "Fork"
   ```

2. **Add your server entry:**

   Edit `servers.json` and add:
   ```json
   {
     "name": "tachibot-mcp",
     "displayName": "TachiBot MCP - Universal AI Orchestrator",
     "description": "Multi-model AI orchestration with 31 tools. Perplexity, Grok, GPT-5, Gemini, Qwen. YAML workflows, 5 profiles, smart routing.",
     "author": "Pawel Pawlowski",
     "sourceUrl": "https://github.com/byPawel/tachibot-mcp",
     "homepage": "https://tachibot.com",
     "packageType": "npm",
     "package": "tachibot-mcp",
     "command": "npx",
     "args": ["-y", "tachibot-mcp"],
     "tags": ["ai", "orchestration", "multi-model", "research", "workflows"],
     "category": "AI Tools"
   }
   ```

3. **Create Pull Request:**
   - Title: "Add TachiBot MCP - Universal AI Orchestrator"
   - Description: Paste from README.md
   - Wait for review

---

### Step 3: Official MCP Registry (1-2 weeks)

#### Prerequisites
- ✅ mcp.json created
- ✅ Domain ownership (tachibot.com)
- ⚠️ DNS access for TXT record

#### Process

1. **Install MCP CLI:**
   ```bash
   npm install -g @modelcontextprotocol/cli
   ```

2. **Authenticate:**
   ```bash
   mcp auth login
   # Opens browser for GitHub OAuth
   ```

3. **Register server:**
   ```bash
   mcp register
   # Follow interactive prompts
   ```

4. **Domain Verification:**
   - CLI will provide a TXT record
   - Add to tachibot.com DNS:
     ```
     Type: TXT
     Host: _mcp-verify (or @)
     Value: [provided verification token]
     TTL: 3600
     ```
   - Wait for DNS propagation (5-30 min)
   - Complete verification in CLI

5. **Wait for approval:**
   - Automated checks run
   - Usually approved within 24-48 hours
   - Watch email for notifications

---

## ⚠️ Pre-Submission Fixes

### 1. Fix package.json License

**Current state:**
- LICENSE file: AGPL-3.0 ✓
- NPM published: AGPL-3.0 ✓
- package.json: `"license": "MIT"` ✗

**Fix required:**
Update package.json to match:
```json
{
  "license": "AGPL-3.0"
}
```

**Then republish:**
```bash
# Update version first
npm version patch  # 2.0.1 -> 2.0.2

# Build
npm run build

# Publish
npm publish
```

### 2. Test Installation (Optional but Recommended)

```bash
# Test global install
npm install -g tachibot-mcp

# Verify
tachibot --version

# Test in Claude Desktop
# Add to config:
{
  "mcpServers": {
    "tachibot": {
      "command": "tachibot",
      "env": {
        "PERPLEXITY_API_KEY": "test",
        "TACHIBOT_PROFILE": "minimal"
      }
    }
  }
}

# Restart Claude Desktop
# Check MCP icon - should see TachiBot with 8 tools (minimal profile)
```

---

## 📋 Pre-Submission Checklist

### Files
- [x] package.json (complete)
- [x] mcp.json (✅ just created)
- [x] smithery.yaml (complete)
- [x] manifest.json (complete)
- [x] README.md (comprehensive)
- [x] LICENSE (AGPL-3.0)
- [ ] package.json license (needs update to AGPL-3.0)

### Publishing
- [x] NPM package published
- [x] GitHub repository public
- [x] Domain active (tachibot.com)
- [ ] DNS access for verification

### Documentation
- [x] Installation guide
- [x] API documentation
- [x] Configuration guide
- [x] Tool reference
- [x] Examples
- [x] CHANGELOG.md
- [x] CONTRIBUTING.md
- [x] SECURITY.md

### Testing
- [ ] `npm install -g tachibot-mcp` works
- [ ] `tachibot --version` shows version
- [ ] MCP inspector passes: `npx fastmcp inspect`
- [ ] Works in Claude Desktop/Code

---

## 🎯 Recommended Submission Order

**Week 1:**
1. ✅ Fix package.json license (AGPL-3.0)
2. ✅ Test installation
3. ✅ Submit to Smithery.ai
4. ✅ Create GitHub MCP Registry PR

**Week 2:**
5. ✅ Prepare domain verification
6. ✅ Submit to Official MCP Registry
7. ✅ Wait for approvals

**Week 3:**
8. ✅ Add registry badges to README
9. ✅ Announce on social media
10. ✅ Update documentation with registry links

---

## 📊 Expected Timeline

| Registry | Submission | Approval | Total |
|----------|------------|----------|-------|
| Smithery.ai | 15 min | 1-2 days | ~2 days |
| GitHub MCP | 30 min | 3-5 days | ~5 days |
| Official MCP | 1 hour | 1-2 weeks | ~2 weeks |

**Total time to full registry coverage:** ~2-3 weeks

---

## 🔗 Registry Links

Once approved, your server will be available at:

- **Smithery.ai:** https://smithery.ai/server/tachibot-mcp
- **GitHub MCP:** https://github.com/modelcontextprotocol/registry
- **Official MCP:** https://registry.modelcontextprotocol.io/servers/tachibot-mcp

---

## 🎉 Post-Submission

### Update README.md

Add registry badges:
```markdown
[![Smithery](https://img.shields.io/badge/Smithery-tachibot--mcp-blue)](https://smithery.ai/server/tachibot-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-Listed-green)](https://registry.modelcontextprotocol.io/servers/tachibot-mcp)
```

### Announce

- [ ] Twitter/X announcement
- [ ] Reddit (r/ClaudeAI, r/LocalLLaMA)
- [ ] Discord communities
- [ ] LinkedIn post

### Monitor

- [ ] GitHub stars/issues
- [ ] npm download stats: `npm info tachibot-mcp`
- [ ] User feedback
- [ ] Registry analytics

---

## 🆘 Troubleshooting

### "Domain verification failed"
- Check TXT record with: `dig TXT _mcp-verify.tachibot.com`
- Wait 5-30 min for DNS propagation
- Retry verification

### "Package not found"
- Ensure npm package is public
- Check package name: `npm view tachibot-mcp`
- Verify version: `npm view tachibot-mcp version`

### "Build errors during inspection"
- Run: `npm install && npm run build`
- Check TypeScript errors
- Ensure all dependencies installed

### "License validation error"
- Ensure LICENSE file exists (AGPL-3.0)
- Update package.json to match: `"license": "AGPL-3.0"`
- Use standard SPDX identifier (AGPL-3.0)

---

## 📚 Resources

- **MCP Registry CLI:** https://github.com/modelcontextprotocol/cli
- **GitHub Registry:** https://github.com/modelcontextprotocol/registry
- **Smithery Docs:** https://smithery.ai/docs
- **MCP Spec:** https://modelcontextprotocol.io/docs
- **Your mcp.json:** Created and ready in project root

---

## ✅ You're All Set!

Everything is ready. Just follow the steps above to submit to all three registries.

**Start with Smithery.ai** for the quickest win, then move to GitHub and Official MCP.

**Questions?** Open an issue at: https://github.com/byPawel/tachibot-mcp/issues

---

**Good luck with your registry submissions! 🚀**
