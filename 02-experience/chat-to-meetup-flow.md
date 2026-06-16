# Chat To Meetup Flow

## Goal

Move a matched group from initial conversation to a confirmed real-world meetup with clear logistics and safety context.

## Flowchart

```mermaid
flowchart TD
    A[Group chat opens] --> B[Safety and intent reminder]
    B --> C{First message sent within 24 hours?}
    C -->|No| D[Gentle reply prompt]
    D --> E{Any response before expiry?}
    E -->|No| F[Chat expires with reactivation option]
    E -->|Yes| G[Active chat]
    C -->|Yes| G
    G --> H{User opens planner?}
    H -->|No| I[Contextual planning prompt after activity threshold]
    I --> G
    H -->|Yes| J[Suggest times and neighborhoods]
    J --> K{Venue suggestions available?}
    K -->|No| L[Manual venue entry]
    K -->|Yes| M[Venue poll]
    L --> N[Time poll]
    M --> N
    N --> O{All required RSVPs received?}
    O -->|No| P[RSVP reminders]
    P --> Q{RSVP deadline passed?}
    Q -->|Yes| R[Plan not confirmed]
    Q -->|No| O
    O -->|Yes| S[Confirmed plan]
    S --> T[Share plan prompt]
    T --> U{User shares plan?}
    U -->|Yes| V[Trusted contact notified]
    U -->|No| W[Skip with safety reminder]
    V --> X[Meetup day reminder]
    W --> X
    X --> Y{Cancellation or safety issue?}
    Y -->|Cancel| Z[Cancellation flow]
    Y -->|Report| AA[Safety report flow]
    Y -->|No| AB[Attendance confirmation]
    AB --> AC{Attended?}
    AC -->|Yes| AD[Post-meetup check-in]
    AC -->|No| AE[No-show or missed meetup flow]
```

## Core Rules

- Group chat should always show planner, safety, and leave/report controls.
- Planning prompts should be state-change prompts, not habit pings.
- A plan is not confirmed until required attendees RSVP.
- Users can cancel without harassment; repeated no-shows affect quality standing.
- Private breakouts are not required to confirm a meetup.

---
<!-- doc-version: 1.0 -->
