---
"@cloudnux/local-cloud-provider": minor
"@cloudnux/dev-console": minor
---

Support AWS-style `rate()` and `cron()` schedule expressions in the local scheduler (alongside plain unix cron). Rates run at a true fixed interval, `cron()` handles AWS day-of-week numbering, `?`, `L`, `#` and the year field, and invalid expressions now report the reason. The dev console shows a RATE/CRON badge, a human-readable description and the next runs for each schedule.
