# Security Specification - Health & Weight Loss App

## Data Invariants
1. A user can only read and write their own profile document.
2. A user can only read and write their own progress logs.
3. Progress logs must belong to a valid user.
4. Weights must be positive numbers.
5. `userId` in progress logs must match the authenticated user's UID.

## The "Dirty Dozen" Payloads (Denial Tests)
1. **Unauthorized Profile Read**: Attempt to read `/users/other_user_id` as `user_123`.
2. **Unauthorized Profile Write**: Attempt to create `/users/other_user_id` as `user_123`.
3. **Ghost Field Injection**: Adding `isAdmin: true` to a user profile update.
4. **ID Poisoning**: Using a 2KB string as a document ID.
5. **Timestamp Spoofing**: Sending a client-side `createdAt` that doesn't match `request.time`.
6. **Orphaned Progress**: Creating a progress log for a user ID that doesn't exist.
7. **Negative Weight**: Logging a weight of `-50`.
8. **Malicious Progress List**: Querying all progress logs across all users.
9. **Identity Spoofing**: Creating a progress log with `userId: 'victim_id'` as `attacker_id`.
10. **State Corruption**: Deleting another user's progress log.
11. **Excessive Field Size**: Sending a `note` that is 1MB in size.
12. **Type Poisoning**: Sending `weight: "heavy"` instead of a number.

## Test Runner
Verified by `firestore.rules.test.ts`.
