# Onboarding Flow

## Goal

Move a new user from account creation to verified group eligibility without exposing any matching inventory before verification.

## Flowchart

```mermaid
flowchart TD
    A[Open app] --> B{Existing account?}
    B -->|No| C[Create account]
    B -->|Yes| D[Sign in]
    C --> E[Accept community standards]
    D --> F{Verification complete?}
    E --> G[Identity verification]
    G --> H{Verification result}
    H -->|Approved| I[Create individual identity card]
    H -->|Retry needed| G
    H -->|Failed| J[Verification appeal]
    H -->|Rejected| K[No matching distribution]
    J --> L{Appeal approved?}
    L -->|Yes| I
    L -->|No| K
    F -->|No| G
    F -->|Yes| I
    I --> M[Set intent and boundaries]
    M --> N[Choose mode preference]
    N --> O{Create or join group?}
    O -->|Create| P[Create group shell]
    O -->|Join invite| Q[Accept group invite]
    O -->|Explore pods| R[Join pod waitlist]
    P --> S[Invite friend]
    Q --> T{Group complete?}
    R --> U{Pod slot available?}
    S --> V{Friend joins and verifies?}
    V -->|Yes| W[Build group profile]
    V -->|No| X[Pending group state]
    T -->|Yes| W
    T -->|No| X
    U -->|Yes| Y[Pod signup]
    U -->|No| Z[Waitlist and invite friend prompt]
    W --> AA{Required group fields complete?}
    AA -->|Yes| AB[Eligible for introductions]
    AA -->|No| AC[Profile completion prompt]
    AC --> W
```

## Error and Edge States

- Verification fails because the document is unreadable: show retry with clear reason.
- Verification provider is unavailable: block distribution and let the user resume later.
- User is under minimum age: reject and provide account closure path.
- Invite is expired, full, or revoked: show neutral error and allow create-group path.
- Friend joins but does not verify: group remains pending.
- User abandons onboarding: resume at last incomplete eligibility step.

---
<!-- doc-version: 1.0 -->
