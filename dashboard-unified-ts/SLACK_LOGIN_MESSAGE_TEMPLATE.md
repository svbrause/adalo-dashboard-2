# Slack message template (New App Logins)

Use this text in your Airtable automation when sending to Slack. Replace each bracketed placeholder with the automation’s insert field for that Airtable column.

---

## Message body

**New app login**

- **Who:** [Name]
- **When:** [Logged in at]
- **App:** [Source]
- **Provider code:** [Provider Code]
- **Provider ID:** [Provider Id]
- **Email:** [Email]
- **Stage:** [Stage]
- **Session ID:** [Session ID]
- **Metadata:** [Metadata]

---

## Plain copy-paste (for Slack message builder)

```
New app login

Who: [Name]
When: [Logged in at]
App: [Source]
Provider code: [Provider Code]
Provider ID: [Provider Id]
Email: [Email]
Stage: [Stage]
Session ID: [Session ID]
Metadata: [Metadata]
```

---

## Airtable field names

| Placeholder       | Airtable column name |
| ----------------- | -------------------- |
| `[Name]`          | Name                 |
| `[Logged in at]`  | Logged in at         |
| `[Source]`        | Source               |
| `[Provider Code]` | Provider Code        |
| `[Provider Id]`   | Provider Id          |
| `[Email]`         | Email                |
| `[Stage]`         | Stage                |
| `[Session ID]`    | Session ID           |
| `[Metadata]`      | Metadata             |

In the Airtable automation (When record created in **New App Logins** → Send to Slack), use the field picker to insert the value for each column where you see the matching `[Field Name]`. Omit any line (e.g. Email, Metadata) if you want a shorter Slack message.
