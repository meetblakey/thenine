# Post-Meetup Flow

## Goal

Capture attendance, satisfaction, safety feedback, and private romantic or platonic interest after real-world context exists.

## Flowchart

```mermaid
flowchart TD
    A[Meetup end time passes] --> B[Send post-meetup check-in]
    B --> C{User opens check-in?}
    C -->|No| D[Reminder within 24 hours]
    D --> E{Still no response?}
    E -->|Yes| F[Mark debrief missing]
    E -->|No| G[Attendance question]
    C -->|Yes| G
    G --> H{Did you attend?}
    H -->|No| I[No-show reason]
    I --> J{Safety concern?}
    J -->|Yes| K[Safety report flow]
    J -->|No| L[Close debrief]
    H -->|Yes| M[Rate plan quality]
    M --> N{Any safety issue?}
    N -->|Yes| K
    N -->|No| O[Private interest capture]
    O --> P[Select friend, crush, both, or no interest for each attendee]
    P --> Q[Submit]
    Q --> R{Mutual edge exists?}
    R -->|No| S[Thank-you and next group prompt]
    R -->|Yes| T{Edge type}
    T -->|Friend| U[Offer group-friendly follow-up]
    T -->|Crush| V[Offer breakout or next plan]
    T -->|Both| W[Offer choose path]
    U --> X[Create optional follow-up]
    V --> Y[Mutual breakout request]
    W --> X
    W --> Y
    K --> Z[Protective actions and support]
```

## Core Rules

- Interest is private unless mutual.
- Users can report safety issues without completing interest capture.
- A group can have a successful social outcome without a romantic edge.
- Attendance confirmation contributes to north-star measurement only when corroborated by acceptable signals.
- Debrief data should improve future matching and safety operations without exposing sensitive details.

---
<!-- doc-version: 1.0 -->
