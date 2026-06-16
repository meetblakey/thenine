# Screen Inventory

| Screen | Entry Points | Primary CTA | Empty State | Loading State | Error State | Populated State | Exit Points |
|---|---|---|---|---|---|---|---|
| Welcome | App launch, logged-out link | Get verified | Product promise and sign-in options | Auth session check | Cannot load session | Welcome copy and account entry | Verification, sign-in |
| Identity Verification | Welcome, Profile, blocked distribution state | Verify identity | Explanation of why verification is required | Verification provider processing | Failed, expired, or rejected verification | Approved status and trust badge | Group creation, appeal, profile |
| Verification Appeal | Failed verification | Submit appeal | Appeal requirements | Upload/process appeal | Missing info or appeal denied | Appeal submitted with review timing | Verification, support |
| Create Group | Home, Group tab | Invite friend | Explanation of group-only model | Creating group shell | Cannot create group | Draft group with missing member/profile items | Invite friend, edit group, home |
| Invite Friend | Create Group, Group tab | Send invite | No invite sent | Invite sending | Invalid contact, blocked invite, rate limit | Sent invite and pending status | Share link, group draft, cancel |
| Join Group Invite | Deep link, notification | Join group | Invite details | Invite validation | Expired, full, revoked, or verification required | Group preview and join consent | Verification, group setup |
| Group Profile Builder | Group tab, onboarding | Publish group | Missing group vibe prompts | Saving profile | Incomplete required field | Shared vibe, intent, availability, member cards | Introductions, group tab |
| Vouch Blurb | Group profile, invite flow | Submit vouch | Prompt to describe friend/group | Saving | Blurb rejected by moderation | Submitted vouch with edit option | Group profile |
| Home | App open, tab nav | Continue next action | No complete group or no active plan | Loading group status | Cannot load status | Next action, intro count, upcoming plan | Group, introductions, chat, plans |
| Introductions | Home, notification | Express interest | No current introductions | Loading curated groups | Failed to load or city waitlist | 3-5 group cards with context | Group card, pass, interest, home |
| Group Card Detail | Introductions | Send group interest | Not applicable | Loading detail | Group unavailable | Shared vibe, members, vouches, intent, availability | Interest, pass, report, back |
| Mutual Match | Push, in-app transition | Open group chat | Not applicable | Creating chat | Match expired or group unavailable | Matched group summary and safety reminder | Chat, introductions |
| Group Chat | Match, notification | Propose plan | No messages yet | Loading messages | Message failed, moderation block | Messages, prompts, plan module, safety tools | Plan, breakout request, report, leave |
| Plan Poll | Group chat | Vote | No proposed times/venues | Loading suggestions | Suggestions unavailable | Venue/time options and votes | Confirm plan, chat |
| Plan Detail | Plans, chat | Confirm RSVP | No plan selected | Loading plan | Venue/time unavailable | Confirmed or pending plan with safety context | RSVP, share plan, cancel, chat |
| Share Plan | Plan detail, safety center | Share with trusted contact | No trusted contact | Sending share | Contact invalid or send failed | Shared contact confirmation | Plan, trusted contacts |
| Cancel Plan | Plan detail | Confirm cancellation | Cancellation reason options | Processing | Cancellation failed | Cancellation submitted and group notified | Plans, chat |
| Breakout Request | Group chat, debrief | Request breakout | Not eligible yet | Sending request | Request blocked or expired | Pending, accepted, declined states | Private breakout, group chat |
| Private Breakout | Accepted request | Send message | No messages | Loading | Message failed, report lock | Thread with consent reminder | Group chat, report, close |
| Social Pod Signup | Home, Plans | Join a pod | No upcoming pods | Loading pod slots | No eligible slots | Time, neighborhood, vibe, guest options | Pod confirmation, home |
| Pod Confirmation | Pod signup, notification | Confirm attendance | Not applicable | Finalizing group | Pod canceled or full | Venue/time, participants hidden or partial, host role | Plan detail, cancel |
| Post-Meetup Check-In | Plan completion, notification | Submit debrief | No completed meetup | Loading debrief | Submission failed | Attendance, interest, quality, safety questions | Mutual interest, report, home |
| Mutual Interest Result | Debrief | Open next step | No mutual edges | Loading result | Result unavailable | Friend/crush/both mutual paths | Breakout, new plan, home |
| Report Flow | Any profile/chat/plan/debrief | Submit report | Reason categories | Uploading report | Submission failed | Confirmation and next steps | Safety center, leave group |
| Safety Center | Profile, chat, plan | Choose safety action | Safety resources | Loading resources | Cannot load resources | Report, block, leave, share plan, guidelines | Relevant prior screen |
| Subscription | Profile, premium prompt | Upgrade | Free plan explanation | Loading offers | Offer unavailable | Transparent tiers and cancellation note | Purchase, profile |
| Settings and Privacy | Profile | Save changes | Default privacy settings | Saving | Save failed | Visibility, data, notifications, blocked users | Profile, support |
| Support | Settings, errors | Contact support | Help categories | Sending request | Request failed | Ticket confirmation | Settings, email |

---
<!-- doc-version: 1.0 -->
