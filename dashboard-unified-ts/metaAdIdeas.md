i want to run some ads in meta business manager and am unfamiliar with how to organize and setup my ad, ad sets, campaigns, and variants. can you explain how this works on meta and what are the best practices on how to setup the ads and keep my testing organized?

I’m pulling together the current Meta setup model and testing guidance so I can give you a clean structure that matches how Ads Manager actually works today.

Thought for 9s

Meta ads are organized in a 3-level hierarchy:

Campaign → Ad Set → Ad

At the campaign level, you choose the business objective. At the ad set level, you control audience, budget/schedule, placements, optimization, and conversion event. At the ad level, you control the creative itself: image/video, primary text, headline, CTA, URL, and identity.

Here’s the simplest way to think about it:

Campaign = what you want Meta to achieve
Ad set = who sees it and how it’s delivered
Ad = what people actually see

For most advertisers, the biggest organizational mistake is creating too many campaigns and ad sets too early. Meta itself recommends simplifying ad set structure and often using Advantage+ campaign budget so Meta can move spend toward the better-performing ad sets automatically, instead of forcing equal spend across everything.

A good practical setup

A clean starting structure is:

1 campaign per goal

Examples:

Leads
Website conversions
Retargeting
Brand awareness only if you truly need it

Do not mix very different goals inside one campaign. If one campaign is for booked consults and another is for cheap traffic, separate them. Campaigns should map to a single business outcome.

2–4 ad sets inside each campaign

Use ad sets only when you are changing a meaningful delivery variable such as:

audience
geography
retargeting window
optimization event
broad vs lookalike vs retargeting
budget control, when needed

Do not make separate ad sets for tiny differences that could live as ads instead. Over-segmentation can hurt delivery and learning. Meta explicitly recommends consolidating similar ad sets.

2–4 ads inside each ad set

This is where you test:

different hooks
different images/videos
different headlines
different body copy
different CTAs

This keeps audience testing separate from creative testing, which makes results much easier to interpret.

Best-practice way to keep testing organized

The core rule is: test one major variable at a time.

If you change audience, creative, placement, and budget all at once, you will not know what caused the result. Meta’s A/B testing guidance is built around comparing versions while changing specific variables like image, text, audience, or placement.

A clean testing sequence looks like this:

Phase 1: find the audience

Create one campaign with 2–3 ad sets:

Broad
Lookalike
Retargeting

Use similar creatives inside each so you are mostly testing audience quality.

Phase 2: find the winning creative

Once an audience is working, keep the audience stable and test:

video vs static image
founder-led video vs UGC-style
before/after angle vs education angle
short copy vs long copy

This is usually best done at the ad level or with Meta’s A/B test / creative test tools.

Phase 3: refine offer or landing page

Only after you have decent traffic and a working ad should you start testing:

CTA language
lead form vs landing page
consultation offer vs educational download
different conversion events

If you are sending traffic to your site, make sure Pixel is installed and Meta recommends pairing it with Conversions API for stronger event tracking and optimization.

Campaign budget vs ad set budget

There are two common budget approaches:

Campaign budget

Meta calls this Advantage+ campaign budget. You set one campaign-level budget and Meta distributes spend across ad sets in real time toward better opportunities. This is often the better default once you have a few ad sets that are all legitimately competing.

Ad set budget

You control the spend separately inside each ad set. This is useful when you want cleaner testing or guaranteed spend by audience bucket.

A practical rule:

Use ad set budgets when you are in early testing and want controlled comparisons.
Use campaign budget when you already know the ad sets belong together and want Meta to optimize spend.
A naming system that keeps things sane

Use a consistent naming convention at all 3 levels.

Campaign

Goal | Funnel | Offer | Geo | Date
Example:
Leads | Prospecting | Free AI Consult | US | Apr2026

Ad set

Audience | Placement/Optimization | Window
Example:
Broad Women25-54 | Leads | 7DClick
LAL 2% Past Leads | Leads | 7DClick
Retarget Site Visitors 30D | Leads | 7DClick

Ad

Creative type | Hook | Format | Version
Example:
FounderVideo | Why patients delay | 4x5 | V1
Static | See what AI finds | 1x1 | V2

That way, when you export results, you can actually read what happened.

What beginners usually do wrong

The most common mistakes are:

too many campaigns
too many ad sets with tiny audiences
making a new ad set for every creative
changing settings too often during learning
judging results too early
poor tracking setup

Meta has a defined learning phase, and significant edits can reset learning. Too much tinkering makes performance noisier and harder to evaluate.

A simple starter structure I’d recommend

If you are new and want to stay organized, start with this:

Campaign 1: Prospecting / New people

3 ad sets:

Broad
Lookalike
Interest stack or another audience type only if you have a reason

Each ad set:

3 ads max to start
same landing page
same conversion goal
Campaign 2: Retargeting

2 ad sets:

7-day visitors/engagers
30-day visitors/engagers

Each ad set:

2–3 ads
stronger social proof / urgency / CTA

That is enough structure to learn without creating chaos.

How to think about “variants”

“Variants” usually means different versions of one controllable thing:

same audience, different creative
same creative, different audience
same audience + creative, different placement or copy

Keep variants grouped logically:

audience tests live across ad sets
creative tests live across ads
goal tests live across campaigns

That single rule will keep your account much more understandable.

If you want the cleanest testing possible

Use Meta’s A/B testing tool when you want a more controlled experiment, since Meta can randomize users into separate groups and compare the versions more cleanly than casual side-by-side changes.

My practical recommendation for you

Since you’re unfamiliar with the platform, I would start with:

2 campaigns total: prospecting and retargeting
2–3 ad sets per campaign
2–3 ads per ad set
start with ad set budgets for testing clarity
once winners emerge, consolidate and move to campaign budget
install Pixel + Conversions API before spending meaningful money

That will keep things simple, interpretable, and scalable.

I can map this into a concrete example for your business—like exactly how I’d structure campaigns for Ponce AI lead gen on Meta.

> **Objective:** Test geo-targeted lookalike audiences vs. pixel retargeting to drive webinar registrations for MedSpa owners, using local speakers (Erin, Reddy, Tanya) as credibility anchors in each market.

---

## Table of Contents

1. [Experiment Overview](https://www.notion.so/Meta-Ads-Webinar-Experiment-Plan-3373cb3b322380caa25ffcf987e122b5?pvs=21)
2. [Webinar Concept](https://www.notion.so/Meta-Ads-Webinar-Experiment-Plan-3373cb3b322380caa25ffcf987e122b5?pvs=21)
3. [Audience Structure](https://www.notion.so/Meta-Ads-Webinar-Experiment-Plan-3373cb3b322380caa25ffcf987e122b5?pvs=21)
4. [Ad Types & Creative](https://www.notion.so/Meta-Ads-Webinar-Experiment-Plan-3373cb3b322380caa25ffcf987e122b5?pvs=21)
5. [Ad Copy Framework](https://www.notion.so/Meta-Ads-Webinar-Experiment-Plan-3373cb3b322380caa25ffcf987e122b5?pvs=21)
6. [Budget Plan](https://www.notion.so/Meta-Ads-Webinar-Experiment-Plan-3373cb3b322380caa25ffcf987e122b5?pvs=21)
7. [Campaign Setup Checklist](https://www.notion.so/Meta-Ads-Webinar-Experiment-Plan-3373cb3b322380caa25ffcf987e122b5?pvs=21)
8. [Tracking & Analytics Setup](https://www.notion.so/Meta-Ads-Webinar-Experiment-Plan-3373cb3b322380caa25ffcf987e122b5?pvs=21)
9. [Daily Monitoring Guide](https://www.notion.so/Meta-Ads-Webinar-Experiment-Plan-3373cb3b322380caa25ffcf987e122b5?pvs=21)
10. [Budget Adjustment Rules](https://www.notion.so/Meta-Ads-Webinar-Experiment-Plan-3373cb3b322380caa25ffcf987e122b5?pvs=21)
11. [Decision Framework](https://www.notion.so/Meta-Ads-Webinar-Experiment-Plan-3373cb3b322380caa25ffcf987e122b5?pvs=21)
12. [Post-Webinar Actions](https://www.notion.so/Meta-Ads-Webinar-Experiment-Plan-3373cb3b322380caa25ffcf987e122b5?pvs=21)

---

## 1. Experiment Overview

| Field                 | Detail                                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Hypothesis**        | A geo-targeted lookalike audience around each speaker's market will register for a local-speaker webinar at a lower cost per registration than general pixel retargeting |
| **Test Duration**     | 3–4 weeks leading up to webinar date                                                                                                                                     |
| **Total Budget**      | $2,700–$3,750 (~$90–$125/day)                                                                                                                                            |
| **Ad Sets**           | 4 (1 pixel retargeting + 3 geo lookalikes)                                                                                                                               |
| **Primary Metric**    | Cost per Registration (CPR)                                                                                                                                              |
| **North Star Metric** | Cost per Attendee who takes a next step                                                                                                                                  |

---

## 2. Webinar Concept

### Topic

> **"How to Double Your Patient Spend at Your MedSpa Using AI"**

### Details

| Field               | Detail                                            |
| ------------------- | ------------------------------------------------- |
| **Speaker**         | Erin [Last Name], Founder of The Treatment MedSpa |
| **Format**          | Free Live Webinar                                 |
| **Recommended Day** | Tuesday or Wednesday evening                      |
| **Lead Time**       | 3–5 weeks from ad launch                          |
| **Platform**        | Zoom Webinar                                      |
| **Duration**        | 45–60 minutes + Q&A                               |

### Why This Topic Works

- Specific, tangible outcome ("double patient spend")
- Credible local speaker — not a generic guru
- Geo relevance ("someone in my market did this")
- Free + live = low commitment to register

### Registration Flow

```
Ad
→ Landing Page or Meta Lead Form
→ Thank You Page (fires CompleteRegistration pixel event)
→ Email Confirmation (immediate)
→ Reminder Sequence (3 days before → 1 day before → 1 hour before)
→ Live Webinar
→ Follow-Up Offer / Consult CTA
```

### Recommended Tools

- **Registration page:** Zoom Webinar, GoHighLevel, or ClickFunnels
- **Email reminders:** GoHighLevel, Mailchimp, or your current CRM
- **Analytics:** Meta Ads Manager + Zoom Webinar report + CRM

---

## 3. Audience Structure

### Four Ad Sets

| Ad Set                    | Audience Type               | Geography                                        | Audience Source      |
| ------------------------- | --------------------------- | ------------------------------------------------ | -------------------- |
| **A — Pixel Retargeting** | All site visitors (30 days) | No geo restriction                               | Meta Pixel           |
| **B — Erin Lookalike**    | 1–2% lookalike from pixel   | Zip codes around The Treatment + 10–20 mi radius | Lookalike from pixel |
| **C — Reddy Lookalike**   | 1–2% lookalike from pixel   | Zip codes around Atlanta locations + radius      | Lookalike from pixel |
| **D — Tanya Lookalike**   | 1–2% lookalike from pixel   | Zip codes around SF locations + radius           | Lookalike from pixel |

### How to Build Lookalike Audiences

1. Go to **Meta Ads Manager → Audiences**
2. Click **Create Audience → Lookalike Audience**
3. Source: Your pixel Custom Audience (site visitors)
4. Audience size: **1–2%** (tighter = more similar to your visitors)
5. Location: Add zip codes + set radius to **10–20 miles**
6. Save each as a named audience (e.g., "Lookalike — Erin — The Treatment")

### Finding Your Pixel Audience Size

1. Go to **Meta Ads Manager**
2. Click menu (≡) → **Audiences**
3. Find your Custom Audience with source = **"Website"**
4. Check the **Size** column (Meta shows a range, e.g., "10,000–50,000")

> ⚠️ If size shows "Too Small" or "--", your pixel needs more data (minimum ~1,000 people)

---

## 4. Ad Types & Creative

### Recommended Formats for This Campaign

| Ad Type           | Priority     | Use Case                                                   |
| ----------------- | ------------ | ---------------------------------------------------------- |
| **Single Image**  | ✅ Primary   | Fast to produce, easy to test, great for cold audiences    |
| **Lead Gen Form** | ✅ Primary   | Native Meta form — frictionless mobile signups             |
| **Video**         | 🔄 Secondary | Speaker intro clip, adds credibility once you have footage |
| **Story/Reel**    | 🔄 Secondary | Broader reach, younger demo                                |
| **Carousel**      | ⬜ Optional  | Use to highlight 3 key webinar takeaways                   |

### Webinar Graphic Checklist

- [ ] Speaker headshot (Erin for this first test)
- [ ] Bold headline: the webinar topic
- [ ] Date + Time + "Free" or "Live"
- [ ] MedSpa logo / branding
- [ ] CTA button: **"Save My Seat"** or **"Register Free"**
- [ ] Text under 20% of image area (Meta penalizes text-heavy images)
- [ ] Recommended size: **1080x1080px** (feed) and **1080x1920px** (stories)

---

## 5. Ad Copy Framework

### Ad Set A — Pixel Retargeting (Warm Audience)

They already know the brand. Skip the intro, lead with value.

**Headline options:**

- "You're Invited: Free Webinar for MedSpa Owners"
- "How to Double Patient Spend Using AI — Save Your Seat"

**Body copy:**

- "You visited [MedSpa site] — now learn the exact system one MedSpa used to double their patient spend using AI. Erin [Last Name] from The Treatment MedSpa is sharing everything live. Free. [Date]. Spots are limited."

**CTA:** Register Now

---

### Ad Sets B / C / D — Lookalike (Cold, Geo-Targeted)

They don't know Erin/Reddy/Tanya. Lead with credibility + local hook.

**Headline options:**

- "How a [City] MedSpa Doubled Patient Spend Using AI"
- "Free Training for MedSpa Owners Near [City]"
- "Local MedSpa Owner Shares Her Exact AI System"

**Body copy:**

- "Erin [Last Name] runs The Treatment MedSpa [location] — and she's going live to share how she used AI to 2x patient revenue. Free webinar. [Date] at [Time]. If you own or manage a MedSpa, this is for you."

**CTA:** Save My Seat

---

### UTM Tags (One Per Ad Set)

Add to each ad set's destination URL so your CRM knows the source:

| Ad Set    | UTM Tag                                                             |
| --------- | ------------------------------------------------------------------- |
| A — Pixel | `?utm_source=meta&utm_campaign=webinar&utm_content=pixel`           |
| B — Erin  | `?utm_source=meta&utm_campaign=webinar&utm_content=erin-lookalike`  |
| C — Reddy | `?utm_source=meta&utm_campaign=webinar&utm_content=reddy-lookalike` |
| D — Tanya | `?utm_source=meta&utm_campaign=webinar&utm_content=tanya-lookalike` |

---

## 6. Budget Plan

### Starting Daily Budgets

| Ad Set                    | Daily Budget     | Monthly Est.      | Rationale                                      |
| ------------------------- | ---------------- | ----------------- | ---------------------------------------------- |
| **A — Pixel Retargeting** | $15–$20/day      | $450–$600         | Warm but small audience — don't over-saturate  |
| **B — Erin Lookalike**    | $25–$35/day      | $750–$1,050       | Cold audience needs more spend to find buyers  |
| **C — Reddy Lookalike**   | $25–$35/day      | $750–$1,050       | Same as above                                  |
| **D — Tanya Lookalike**   | $25–$35/day      | $750–$1,050       | SF CPMs typically higher — may need extra room |
| **Total**                 | **$90–$125/day** | **$2,700–$3,750** |                                                |

### Lean Start Option (Lower Risk)

Cut all budgets by ~30% to start:

- Pixel: $10/day
- Each lookalike: $20/day
- **Total: ~$70/day (~$2,100/month)**

> ⚠️ Do not change budgets in the first 5–7 days. Meta's algorithm needs a learning phase (~50 optimization events per ad set). Changing budget resets learning.

---

## 7. Campaign Setup Checklist

### Meta Pixel Setup

- [ ] Meta Pixel is installed on website
- [ ] `CompleteRegistration` or `Lead` pixel event fires on thank-you page after registration
- [ ] Verify pixel is firing correctly using **Meta Pixel Helper** Chrome extension

### Ads Manager Setup

- [ ] Create one Campaign (objective: **Leads** or **Conversions**)
- [ ] Create 4 Ad Sets (one per audience above)
- [ ] Set attribution to **7-day click, 1-day view** on all 4 ad sets
- [ ] Upload creative (image + copy) — keep identical across all 4 ad sets initially
- [ ] Add UTM parameters to each ad set destination URL
- [ ] Save custom column view: Reach, Frequency, CTR, CPM, Link Clicks, Cost per Result, Amount Spent, Results

### Audience Setup

- [ ] Confirm pixel Custom Audience is built (All Website Visitors, 30-day window)
- [ ] Build Lookalike — Erin (1–2%, geo-filtered)
- [ ] Build Lookalike — Reddy (1–2%, geo-filtered)
- [ ] Build Lookalike — Tanya (1–2%, geo-filtered)
- [ ] All audiences show status: "Ready"

### Webinar Registration Setup

- [ ] Registration landing page is live
- [ ] Thank-you page is live and pixel event is firing
- [ ] Email confirmation sequence is active
- [ ] Reminder emails scheduled (3 days, 1 day, 1 hour before)
- [ ] Zoom Webinar is configured and test link works

---

## 8. Tracking & Analytics Setup

### What to Track & Where

| Metric                             | Where to Find It                             |
| ---------------------------------- | -------------------------------------------- |
| Cost per Registration              | Meta Ads Manager (custom columns)            |
| CTR, CPM, Frequency                | Meta Ads Manager (custom columns)            |
| Which ad set drove each registrant | UTM tags → your CRM / landing page analytics |
| Registration → attendance rate     | Zoom Webinar report (pull after event)       |
| Post-webinar conversions           | CRM (manual match to ad set via UTM)         |

### Ads Manager Custom Column View

Save a view called **"Webinar Experiment"** with:

1. Reach
2. Frequency
3. Impressions
4. CTR (Link Click-Through Rate)
5. CPM
6. Link Clicks
7. Results (registrations)
8. Cost per Result
9. Amount Spent

### Attribution Setting

Set all 4 ad sets to: **7-day click, 1-day view**
This ensures consistent comparison across ad sets.

### Benchmark Targets

| Metric                               | Target                       |
| ------------------------------------ | ---------------------------- |
| Cost per Registration (CPR)          | Under $25                    |
| Click-Through Rate (CTR)             | 1–3% cold / 2–5% retargeting |
| Registration rate (clicks → signups) | 20–40%                       |
| Show-up rate                         | 30–50% of registrants        |
| Cost per Attendee                    | Your real north star         |

---

## 9. Daily Monitoring Guide

### What to Check Each Day (Keep It Simple)

| Phase        | Days      | Check This One Thing                                |
| ------------ | --------- | --------------------------------------------------- |
| Launch       | Days 1–5  | Is each ad set spending? (If not, delivery problem) |
| Early data   | Days 5–10 | Cost per Registration on each ad set                |
| Optimization | Days 10+  | Cost per Attendee (factor in Zoom show-up rate)     |

### Weekly Deep Dive

| When              | What to Check                     | Possible Action                          |
| ----------------- | --------------------------------- | ---------------------------------------- |
| **Day 3–5**       | CPM, CTR, early registrations     | Pause any ad set with CPM >2x the others |
| **End of Week 1** | Cost per registration by ad set   | Shift budget toward lowest CPR           |
| **End of Week 2** | Frequency, registration pace      | Refresh creative if frequency >6         |
| **Post-webinar**  | Show-up rate, conversion to offer | Decide which market to scale next        |

---

## 10. Budget Adjustment Rules

### Decision Tree

```
Is Cost per Registration (CPR) available yet?
│
├── NO (fewer than 10 registrations) → Hold budget, wait until Day 10
│
└── YES → Compare CPR across all 4 ad sets
          │
          ├── CPR < $20 → Increase budget 20–30% every 3–4 days
          │               (never jump more than 50% at once)
          │
          ├── CPR $20–$40 → Hold budget, test new creative first
          │
          └── CPR > $50 after $300 spent → Pause ad set, diagnose issue
```

### Specific Triggers

| Trigger                                           | Action                                        |
| ------------------------------------------------- | --------------------------------------------- |
| One ad set has 2x better CPR than others          | Shift $10–15/day from worst to best performer |
| Frequency hits 8+ on pixel audience (Ad Set A)    | Reduce pixel budget or refresh creative       |
| SF/Tanya CPMs run >50% higher than others         | Increase budget to compensate or narrow geo   |
| Registration pace too slow for webinar date       | Increase top performer by 40–50%              |
| 10 days out and fewer than 50 total registrations | Increase all budgets 25% across the board     |

---

## 11. Decision Framework

### Green Light to Scale

- Cost per registration < $25
- Show-up rate > 30%
- At least 1 attendee converts to a paid offer or consult

### Pivot Signal

- CPR > $40 after $300 spent on an ad set
- CTR < 0.5% (creative problem, not audience)
- One geo dramatically outperforms → double down there

### Kill Signal

- $500 spent on an ad set with zero registrations

### Post-Experiment Next Steps

| Result                       | Action                                                                     |
| ---------------------------- | -------------------------------------------------------------------------- |
| Pixel outperforms lookalikes | Invest in growing site traffic to build larger pixel audience              |
| One geo lookalike wins       | Replicate webinar with Reddy (Atlanta) and Tanya (SF) using same structure |
| All 4 perform similarly      | Scale all budgets 25–30% and run a second webinar                          |
| Poor results across all      | Audit landing page conversion rate before changing ads                     |

---

## 12. Post-Webinar Actions

### Immediately After Webinar

- [ ] Pull Zoom Webinar report (registrants vs. attendees)
- [ ] Calculate show-up rate per ad set (match via UTM tags in CRM)
- [ ] Send replay email to all registrants within 24 hours
- [ ] Send follow-up offer / consult CTA to attendees

### Within 1 Week

- [ ] Calculate Cost per Attendee per ad set
- [ ] Identify which market (Erin / Reddy / Tanya) had best engagement
- [ ] Decide: scale winning market or replicate structure in next market
- [ ] Document learnings in this doc for next experiment

### Metrics to Record for Next Round

| Metric                   | Ad Set A | Ad Set B | Ad Set C | Ad Set D |
| ------------------------ | -------- | -------- | -------- | -------- |
| Total Spend              |          |          |          |          |
| Registrations            |          |          |          |          |
| Cost per Registration    |          |          |          |          |
| Attendees                |          |          |          |          |
| Cost per Attendee        |          |          |          |          |
| Post-webinar Conversions |          |          |          |          |

---

_Last updated: April 2026_
