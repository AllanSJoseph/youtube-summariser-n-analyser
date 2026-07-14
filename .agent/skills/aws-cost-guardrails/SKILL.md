---
name: aws-cost-guardrails
description: Use this skill whenever provisioning new AWS resources, or reviewing whether a proposed change to infrastructure is appropriate for the MVP stage.
---

# AWS cost guardrails

## Know which free-tier model applies
AWS changed its free tier structure on July 15, 2025:
- **Accounts created before that date**: legacy 12-month free tier (750 hrs/month EC2 t3.micro, 750 hrs/month RDS db.t3.micro, etc.)
- **Accounts created after that date**: Free Plan with $100-200 in credits expiring after 6 months (or when exhausted), not a fixed monthly allowance

Confirm which applies before assuming any specific number of free hours is available. This changes over time — re-check current terms at aws.amazon.com/free if it's been a while.

## Always-free services (true regardless of account age)
Lambda, DynamoDB, S3 (5GB), CloudFront (1TB/month out), SQS (1M requests/month), SNS. Prefer these over paid-tier equivalents where the use case allows it.

## Resources that are never free — check before provisioning
- **Application Load Balancer** — provisioned automatically by a load-balanced EB environment; ~$16-20/month minimum. Use single-instance EB (see `skills/eb-deployment/SKILL.md`) to avoid this at MVP stage.
- **NAT Gateway** — ~$32/month. Avoid provisioning a private VPC subnet setup that requires one unless there's a concrete reason (e.g. compliance requirement).
- **RDS Multi-AZ** — doubles RDS cost, not covered by free tier even on legacy accounts. Stay single-AZ for MVP.
- Unattached Elastic IPs, idle EBS volumes on stopped instances, and forgotten snapshots — these accrue cost silently even when nothing is "running."

## Before provisioning any new resource, ask
1. Is there an Always Free option that does this job at MVP scale?
2. If not, is it covered by the current free tier/credit model?
3. If it's a genuinely paid resource (ALB, NAT Gateway, ElastiCache beyond free hours), is the MVP at a scale that justifies it yet — per the deferred-until-traffic list in `spec/02-technical-architecture.md`?

## Minimum monitoring setup (do this before launch, not after)
- CloudWatch billing alarm at a low threshold (e.g. $5) so you're notified before costs become material
- AWS Cost Anomaly Detection enabled (free, ML-based unusual-spend alerts)
- Know your Free Plan expiry date (6 months from account creation, if on the post-July-2025 model) and calendar-remind yourself before it hits — free-plan accounts auto-close, paid-plan accounts start billing automatically with no prominent warning