---
name: elastic-beanstalk-deployment
description: Use this skill whenever setting up, modifying, or debugging the Elastic Beanstalk environment for this project.
---

# Elastic Beanstalk deployment

## MVP uses single-instance, not load-balanced
```bash
eb init youtube-summarizer --platform node.js-20 --region <your-region>
eb create youtube-summarizer-prod --single --instance-type t3.micro
```
The `--single` flag is load-bearing — it skips provisioning an Application Load Balancer, which is **not covered by any AWS free tier** and costs ~$16-20/month minimum regardless of traffic. Do not remove `--single` without deliberately deciding to take on that cost (e.g. once you need zero-downtime deploys or auto-scaling).

## Trade-offs of single-instance mode (accepted for MVP)
- Deploys briefly take the app down while the instance restarts — acceptable pre-launch/low-traffic, not for a live production app with real users
- No auto-scaling — one t3.micro is the ceiling until you migrate environment types
- Migrating to load-balanced later is a environment-type change, not a code rewrite — don't over-engineer around avoiding this migration

## Config files
`.ebextensions/01-environment.config` — platform-level settings (Node version, `NodeCommand`). Do not put secret values in this file; it's typically committed to source control.

Actual secrets go through `eb setenv`, never in `.ebextensions`:
```bash
eb setenv DATABASE_URL=... YOUTUBE_API_KEY=... GEMINI_API_KEY=... ANTHROPIC_API_KEY=...
```

## RDS stays outside the EB environment
Provision RDS separately (console or `aws rds create-db-instance`), reference it via `DATABASE_URL` env var. Never let RDS lifecycle depend on the EB environment — redeploying or recreating the EB environment must never risk the database. Lock the RDS security group to only accept inbound connections from the EB instance's security group, not `0.0.0.0/0`.

## Common failure modes to check first when debugging
- 502/504 from the app: check `eb logs` for the actual Node process crash, not just EB's health status
- Env vars not taking effect: `eb setenv` triggers a redeploy — confirm it completed, don't assume it's instant
- Can't reach RDS from the app: almost always a security group misconfiguration, check that before touching app code