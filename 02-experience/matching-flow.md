# Matching Flow

## Goal

Present a bounded set of compatible verified groups and unlock group chat only after mutual group-level interest.

## Flowchart

```mermaid
flowchart TD
    A[Eligible group enters Introductions] --> B{Eligible inventory available?}
    B -->|No| C[No introductions state]
    C --> D[Adjust availability or invite more groups]
    B -->|Yes| E[Load bounded daily introductions]
    E --> F{Load successful?}
    F -->|No| G[Retry and support path]
    F -->|Yes| H[Show group card]
    H --> I{User action}
    I -->|Pass| J[Remove from set and record reason optional]
    I -->|Report| K[Report flow]
    I -->|Interest| L[Confirm group interest]
    L --> M{Both group members approve?}
    M -->|No| N[Pending internal approval]
    N --> O{Approval expires?}
    O -->|Yes| P[Interest expired]
    O -->|No| M
    M -->|Yes| Q[Send interest to other group]
    Q --> R{Other group has mutual interest?}
    R -->|No| S[Pending or no match]
    R -->|Yes| T[Create group chat]
    T --> U[Show mutual match screen]
    U --> V[Open group chat]
    J --> W{More introductions today?}
    W -->|Yes| H
    W -->|No| X[End of set]
```

## Matching Rules

- Every displayed group is complete and verified.
- Introductions are finite and refreshed on a predictable schedule.
- Ranking can consider intent, neighborhood, availability, vibe, safety standing, and prior responsiveness.
- Ranking must not suppress baseline visibility to sell paid features.
- Users can understand the visible reasons a group is recommended.
- Groups can opt out of being shown to specific groups or categories where policy allows.

---
<!-- doc-version: 1.0 -->
