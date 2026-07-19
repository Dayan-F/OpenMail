import type { EmailMeta } from "@/lib/types";

export const MOCK_EMAILS: EmailMeta[] = [
  {
    id: "mock_001",
    from: "sarah.chen@acmecorp.com",
    subject: "Re: Your application for Senior Frontend Engineer",
    snippet: "Thank you for your application. We were impressed by your portfolio and would love to schedule...",
    body: `Hi,

Thank you for applying for the Senior Frontend Engineer role at Acme Corp.
We were impressed by your portfolio and would love to schedule a technical interview.

Are you available for a 45-minute video call next week? Please reply with your availability
and we will send a calendar invite.

Looking forward to speaking with you,
Sarah Chen
Talent Acquisition, Acme Corp`,
  },
  {
    id: "mock_002",
    from: "noreply@techstartup.io",
    subject: "Your application to TechStartup — update",
    snippet: "After careful consideration, we have decided to move forward with other candidates whose...",
    body: `Hi,

Thank you for your interest in the Full Stack Engineer position at TechStartup.

After careful consideration, we have decided to move forward with other candidates whose
experience more closely aligns with our current needs.

We appreciate the time you invested and wish you the best in your search.

Best regards,
The TechStartup Team`,
  },
  {
    id: "mock_003",
    from: "alex@friendgroup.com",
    subject: "Weekend hiking trip — are you in?",
    snippet: "Hey! We are planning a hike at Blue Ridge on Saturday the 26th. About 8 miles round trip...",
    body: `Hey!

We're planning a hike at Blue Ridge on Saturday the 26th. About 8 miles round trip,
moderate difficulty. Starting at 8am from the main trailhead.

Are you in? We need a headcount by Thursday so we can book the shuttle.

Let me know!
Alex`,
  },
  {
    id: "mock_004",
    from: "newsletter@devdigest.io",
    subject: "Dev Digest #214 — React 20, Bun 2.0, and the AI editor wars",
    snippet: "This week in tech: React 20 release candidate drops, Bun 2.0 benchmarks blow Node out of the water...",
    body: `DEV DIGEST #214

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• React 20 RC drops with new compiler optimizations
• Bun 2.0 benchmarks 3x faster than Node for HTTP
• The AI editor wars: Cursor vs Windsurf vs Copilot
• Tutorial: Building a type-safe API with tRPC v12

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Unsubscribe | View in browser`,
  },
  {
    id: "mock_005",
    from: "billing@aws.amazon.com",
    subject: "Your AWS bill for June 2025 is ready",
    snippet: "Your AWS bill for the period June 1 - June 30, 2025 is now available. Total: $12.47",
    body: `Hello,

Your AWS bill for the period June 1 – June 30, 2025 is now available.

Total amount due: $12.47
Payment method: Visa ending in 4242
Payment date: July 3, 2025

View your detailed bill at console.aws.amazon.com/billing.

Amazon Web Services`,
  },
  {
    id: "mock_006",
    from: "marcus.w@collegefriend.net",
    subject: "Catching up — coffee next week?",
    snippet: "Long time no talk! I'm going to be in your city for a conference next Tuesday through Thursday...",
    body: `Hey!

Long time no talk! I'm going to be in your city for a conference next Tuesday through Thursday.
Any chance you'd be free for coffee or lunch one of those days?

Would love to catch up. It's been what, two years since the graduation trip?

Let me know what works,
Marcus`,
  },
  {
    id: "mock_007",
    from: "no-reply@promotions.shoppingsite.com",
    subject: "🔥 FLASH SALE — 70% off everything TODAY ONLY!!!",
    snippet: "HUGE SAVINGS!! Click now before it's too late!! Limited stock!! Act fast!!!",
    body: `FLASH SALE — 70% OFF EVERYTHING!!

Don't miss out!! Click the link below!!!
LIMITED TIME OFFER!! TODAY ONLY!!

[SHOP NOW] [SHOP NOW] [SHOP NOW]

Unsubscribe from promotional emails`,
  },
  {
    id: "mock_008",
    from: "recruiter@bigtech.com",
    subject: "Exciting opportunity at BigTech — Staff Engineer role",
    snippet: "Hi, I came across your profile and thought you might be a great fit for a Staff Engineer position...",
    body: `Hi,

I came across your profile and thought you might be a great fit for a Staff Engineer position
on our Platform team at BigTech.

The role involves leading the architecture of our developer tooling infrastructure.
Compensation is $280k–$340k total comp depending on level.

Would you be open to a quick 20-minute call to learn more? No pressure at all.

Best,
Jamie
Technical Recruiter, BigTech`,
  },
];
