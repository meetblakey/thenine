# Group Creation Flow

## Goal

Create a complete, verified, discoverable group without exposing non-consenting invitees or incomplete groups.

## Flowchart

```mermaid
flowchart TD
    A[Verified member taps Create Group] --> B[Choose group mode]
    B --> C{Quartet group or pod guest?}
    C -->|Quartet| D[Name group and add shared vibe]
    C -->|Pod guest| E[Choose bring-a-friend option]
    D --> F[Set group intent]
    F --> G[Set neighborhoods and availability]
    G --> H[Invite friend]
    H --> I{Invite delivery successful?}
    I -->|No| J[Show delivery error and alternate share link]
    I -->|Yes| K[Pending friend]
    K --> L{Friend opens invite?}
    L -->|No before expiry| M[Expired invite]
    L -->|Yes| N{Friend verified?}
    N -->|No| O[Friend verification flow]
    O --> P{Approved?}
    P -->|No| Q[Group remains pending]
    P -->|Yes| R[Friend joins group]
    N -->|Yes| R
    R --> S[Each member completes individual sub-card]
    S --> T[Members write optional vouch blurbs]
    T --> U{Required group fields complete?}
    U -->|No| V[Completion checklist]
    V --> S
    U -->|Yes| W[Preview group visibility]
    W --> X{Both members approve publish?}
    X -->|No| Y[Draft group]
    X -->|Yes| Z[Eligible group]
    E --> AA[Select pod preferences]
    AA --> AB[Invite optional guest]
    AB --> AC{Guest accepted and verified?}
    AC -->|Yes| AD[Pod guest pair eligible]
    AC -->|No| AE[Applicant held until assigned to pod group]
```

## Core Rules

- In quartet mode, a group is not eligible until both members are verified and approve publishing.
- An invited friend is never publicly visible before joining.
- Group name, shared vibe, intent, neighborhood, availability, and member sub-cards are required.
- Vouch blurbs are optional for launch but strongly encouraged.
- A member can leave a group at any time; the group then becomes ineligible until complete again.

---
<!-- doc-version: 1.0 -->
