# AI And Algorithmic Transparency

## AI Product Position

AI may improve matching, prompts, and planning, but it must preserve user agency. [APPNAME] should use AI as decision support, not as a hidden persuasion engine.

## Allowed AI Uses

| Use | Purpose | User Control |
|---|---|---|
| Recommendation support | Rank compatible group introductions by intent, availability, location, and quality signals | Explain major reasons and allow preference changes |
| Prompt suggestions | Help groups start conversation or plan | User chooses whether to send |
| Venue suggestions | Recommend appropriate plan locations | User votes or edits |
| Safety triage | Prioritize reports and detect harmful content | Human review for severe ambiguous cases |
| Quality insights | Improve future matching from debrief patterns | Do not expose scores publicly |

## Restricted AI Uses

- Writing messages as if sent by the user without explicit user action.
- Manipulating visibility to sell paid products.
- Public desirability scoring.
- Hidden vulnerability targeting.
- Automated enforcement with no appeal for high-impact decisions.
- Inferring sensitive traits for ranking unless lawful, necessary, and consented.

## Transparency Requirements

- Show understandable recommendation reasons on group cards.
- Label AI-generated suggestions as suggestions.
- Explain that prompts are optional.
- State that paid features do not suppress unpaid visibility.
- Provide preference controls.
- Provide appeal paths for identity and enforcement outcomes where required.

## Matching Explanation Model

Recommendation reasons should use plain categories:

- Shared availability.
- Nearby neighborhoods.
- Compatible relationship intent.
- Similar plan preference.
- Complementary group vibe.
- Strong attendance and responsiveness history.

Do not show:

- Attractiveness scores.
- Comparative ranking.
- Hidden desirability tiers.
- "People like you" vulnerability messaging.

## AI Risk Review Questions

Before launch of an AI-supported feature, product must answer:

- Does the user understand what the system is doing?
- Can the user decline or override the suggestion?
- Does the feature materially affect who gets seen or contacted?
- Could the feature exploit loneliness, insecurity, or urgency?
- Is there a safety or appeal path?
- Does the feature collect or infer sensitive data?

## Open Questions

- **Should [APPNAME] use AI-generated compatibility summaries?** Recommended default: not at launch. Research basis: better filtering matters, but users need legible, low-risk reasons before more interpretive summaries.
- **Should AI rank by likelihood of meeting?** Recommended default: yes, if inputs are transparent and guardrails prevent safety or fairness harms. Research basis: north-star optimization requires meetup likelihood, but opaque ranking can feel rigged.

---
<!-- doc-version: 1.0 -->
