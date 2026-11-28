# TUGON Severity Matrix

How TUGON decides the severity of a resident's report, and which standards each metric is based on.

## How it works

1. A resident submits a report (text and up to 3 photos) from the mobile app.
2. The AI (Google Gemini) reads the text **and looks at the photos**, then gives each of the five metrics below a score from 0 to 3. It also describes what the photos show.
3. **The AI does not choose the severity.** TUGON computes it from the scores with the fixed rule at the bottom of this page. Every report's scores are saved, so the admin (and the panel) can see exactly why a report got its severity.
4. The AI also picks the agencies to dispatch (BFP, PNP, Philippine Coast Guard). TUGON sends the dispatch automatically, and the admin sees every report and its dispatch status.
5. If the AI is unavailable, keyword rules classify the report instead. Those reports are labeled "keyword rules", so staff know to review them.

The definitions live in code at `web/lib/severity-matrix.ts`; the AI prompt and the admin screen both read them from there.

## The five metrics

| Metric | 0 | 1 | 2 | 3 | Based on |
|---|---|---|---|---|---|
| **Life threat** | Nobody hurt or in danger | Minor: small injuries, people can walk (START green) | Serious: needs care soon, can wait minutes to hours (START yellow) | Immediate: trapped, unconscious, not breathing, drowning, heavy bleeding, active violence (START red, ESI level 1) | START triage; Emergency Severity Index |
| **People affected** | Nobody | 1–2 people | 3–9 people, or any child, elderly, PWD or pregnant woman | 10 or more | Casualty count; priority for vulnerable sectors (RA 10121) |
| **Spread risk** | Over or contained | Stable | Could spread or worsen within hours | Spreading or worsening now | Hazard trend, as used in BFP alarm escalation |
| **Area scope** | One spot or household | Several households or one street | Whole barangay | Two or more barangays | NDRRMC Memo Circular No. 44, s. 2016 (IMT levels) |
| **Resources needed** | Information only | One unit | Several units, or one agency plus MDRRMO | Several agencies at once | ESI resource count; ICS incident complexity typing |

**People affected vs. life threat.** "People affected" counts everyone the incident touches (stranded, blocked, displaced), even when nobody is hurt. Injuries and danger to life are scored separately under "Life threat". The resident's own "people affected" number sets the minimum score (1–2 people = 1, 3–9 or any vulnerable person = 2, 10 or more = 3); the AI can score higher, for example from a photo, but never lower.

The AI scores only what the report and photos actually show. Life threat and people affected are 0 when no person is mentioned or visible, even for a fire or a flood.

## Credibility check (false reports)

The AI also checks whether the report makes sense as a real event:

| Credibility | Meaning | What TUGON does |
|---|---|---|
| **Consistent** | Text, photos and location agree, and the event is physically possible | Dispatched automatically |
| **Doubtful** | Some details do not fit (vague text, unclear or partly unrelated photo), but it could be real | Dispatched automatically, flagged so staff verify it |
| **Likely false** | Impossible as described (for example a fire on plain water with no boat, fuel or oil), the photo clearly contradicts the text, the photo is a meme, cartoon, screenshot or stock image, or it reads as a prank | **Held for admin review, not dispatched.** The admin can still dispatch it or reject it. |

Safety rules for the AI: a report is never marked false only because of short text, typos, Taglish or a missing photo, and when a life might really be at risk the AI must choose "Doubtful", not "Likely false". A held report is never lost or deleted: it moves out of the incident queue into the admin's **Flagged reports** page, and the flag is recorded in the system logs (`AI_FLAGGED_FALSE_REPORT`). If the admin confirms it is real (verifies or dispatches it), it returns to the incident queue; if not, the admin rejects it and it stays on the Flagged reports page as a record.

## Severity rule

| Severity | When |
|---|---|
| **Critical** | Life threat is 3, **or** the total is 11 or more (out of 15) |
| **High** | Life threat is 2, **or** spread risk is 3, **or** the total is 7 or more |
| **Medium** | The total is 3 or more |
| **Low** | Anything else |

Life threat alone can make a report Critical, the same way ESI and START put "needs immediate life-saving intervention" first, whatever else is going on.

The database then sets the dispatch **priority**: a High report that involves a vulnerable group becomes Critical priority.

## Standards used

- **START (Simple Triage and Rapid Treatment)**: mass-casualty triage with Immediate (red), Delayed (yellow), Minor (green) and Expectant (black) categories. Source: US HHS CHEMM, [START Adult Triage Algorithm](https://chemm.hhs.gov/startalgotext.htm).
- **Emergency Severity Index (ESI)**: five-level emergency triage. Levels 1–2 are set by urgency (level 1 = needs immediate life-saving intervention); levels 3–5 by how many resources are expected. Source: AHRQ, via [NCBI Bookshelf](https://www.ncbi.nlm.nih.gov/books/NBK557583/) and [Wikipedia](https://en.wikipedia.org/wiki/Emergency_Severity_Index).
- **NDRRMC Memorandum Circular No. 44, s. 2016**: Incident Management Team levels in the Philippine Incident Command System. A barangay team handles an incident in one barangay, and a municipal/city team handles one that affects two or more barangays. Source: OCD ICS training material ([summary](https://asilvainnovations.github.io/ddrive-m/understanding-ics.html)).
- **Incident Command System complexity typing**: incidents are typed from Type 5 (small, local resources) to Type 1 (most complex). Source: FEMA, [Incident Complexity and Type](https://training.fema.gov/emiweb/is/icsresource/assets/Incident%20Complexity%20and%20Type.pdf).
- **RA 10121** (Philippine Disaster Risk Reduction and Management Act of 2010): priority for vulnerable and marginalized groups.
- **BFP alarm escalation**: higher alarms are called as a fire grows and needs more units. Source: [Inquirer explainer](https://newsinfo.inquirer.net/773301/in-the-know-alpha-bravo-charlie-and-other-fiery-tasks/amp).

## Limits to tell the panel

- TUGON **adapts** these standards to resident reports. They were made for trained responders on scene, so the scores are a first estimate. Staff confirm on site and can change the response.
- The AI only sees what the resident wrote and photographed. A blurry or unrelated photo is noted in "photo findings" and does not raise the score.
- The thresholds (11, 7, 3) are TUGON's own design choice, not part of any standard. They can be tuned with MDRRMO Mabini.
