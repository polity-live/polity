# Issue #107 Create subissue drafts

Parent issue: #107
Issue type for each draft: Test

Note: I could not create these on GitHub from this session because there is no authenticated GitHub tool available here, `gh` is not installed, and the integrated browser is not signed in. These drafts are ready to paste into new subissues under #107.

## 1. Group

Title: `🧪 - Create group in carousel mode with invites, linked rights, and a constitutional event`

Body:

```md
### Description

Automated happy-path test for `/create/group` that verifies the create form can switch between one-page and carousel modes, then complete the full group flow in carousel mode while showing positive feedback for each input.

## 📋 Prerequisites

1. An authenticated user can open `/create/group`.
2. Seed at least one selectable user for invites and one existing group for the link-group step.
3. Prepare a CSV file with `first_name,last_name` and at least one row that resolves to an existing user.
4. Start the test with the create form style set to `carousel` or switch to it during the scenario.

## 🔁 Steps / Scenario

1. Open `/create/group`.
2. Click `One page` in the form-style selector.
3. Click `Carousel` in the form-style selector and keep carousel mode for the rest of the scenario.
4. Fill the `Name` input with `Community Lab`.
5. Enter `Local civic coordination group` in the `Description` editor.
6. Fill the `Email` input with `community.lab@example.org`.
7. Select the `Hierarchical` group type option.
8. Click `Next`.
9. Fill the `Country` input.
10. Fill the `Region` input.
11. Fill the `City` input.
12. Fill the `Postal code` input.
13. Fill the `Street` input.
14. Fill the `House number` input.
15. Click `Next`.
16. Upload a group image.
17. Change visibility from the default to `Authenticated`.
18. Add at least two hashtags.
19. Click `Next`.
20. Use `Search users` to add at least one invited member.
21. Upload the CSV invite file.
22. Click `Next`.
23. Use `Select group` to choose an existing group to link.
24. Select `They are parent`.
25. Check at least one right, for example `Information right`.
26. Click `Add group link`.
27. Click `Next`.
28. Enable the `Optional general assembly` switch.
29. Fill the `Event name` input.
30. Fill the `Event location` input.
31. Fill the `Event start date` input.
32. Fill the `Event start time` input.
33. Click `Next`.
34. Review the summary and click `Create`.

## ✅ Expected Assertions

1. One-page mode renders all sections in a single scrollable layout.
2. Carousel mode shows `Previous` and `Next` controls and only the active step panel is visible.
3. The `Name` input shows positive validation feedback and the step remains valid.
4. The `Description` editor keeps the entered text visible.
5. The `Email` input shows positive validation feedback for a valid address.
6. The `Hierarchical` option remains highlighted after selection.
7. The `Next` button is enabled after the required basic-info inputs are valid.
8. The location step is reachable in carousel mode.
9. The `Country` input keeps the entered value.
10. The `Region` input keeps the entered value.
11. The `City` input keeps the entered value.
12. The `Postal code` input keeps the entered value.
13. The `Street` input keeps the entered value.
14. The `House number` input keeps the entered value.
15. The form advances to the next carousel step.
16. The uploaded image shows a visible preview or uploaded state.
17. The `Authenticated` visibility option remains selected/highlighted.
18. The hashtags appear as selected chips/tags.
19. The form advances to the invite step.
20. The invited user appears as a selected chip or badge in the member input.
21. The CSV upload shows a summary card or matched-user badges as positive feedback.
22. The form advances to the link-groups step.
23. The linked target group appears as a selected item in the typeahead.
24. The `Parent` relationship option remains selected.
25. The selected right remains checked.
26. A linked-group row appears with the relationship badge and right badge(s).
27. The form advances to the constitutional-event step.
28. Enabling the switch reveals the nested constitutional-event inputs.
29. The `Event name` input keeps the entered value.
30. The `Event location` input keeps the entered value.
31. The `Event start date` input keeps the entered value.
32. The `Event start time` input keeps the entered value.
33. The review step is reachable in carousel mode.
34. The review step shows the entered name, email, visibility, linked-group summary, invited-member summary, and constitutional-event summary, and clicking `Create` redirects to the new group page.

## 🧩 Notes

Route: `/create/group`

Relevant files:

- `src/features/create/hooks/useCreateGroupForm.tsx`
- `src/features/create/ui/CreateFormShell.tsx`
- `src/features/create/ui/CarouselFormLayout.tsx`
- `src/features/create/ui/OnePageFormLayout.tsx`
- `src/features/create/ui/CreateFields.tsx`

### Execution Type

- [x] Automated
- [ ] Manual

### Viewports

- [ ] Mobile
- [ ] Tablet
- [x] Desktop
```

## 2. Event

Title: `🧪 - Create delegate assembly event in carousel mode with group selection, location, recurrence, and deadlines`

Body:

```md
### Description

Automated happy-path test for `/create/event` that switches layouts once, returns to carousel mode, and creates a delegate assembly event with positive feedback for each entered input.

## 📋 Prerequisites

1. An authenticated user can open `/create/event`.
2. Seed at least one group that the user can manage events for.
3. Start with the create form in carousel mode or switch to it during the test.

## 🔁 Steps / Scenario

1. Open `/create/event`.
2. Click `One page` in the form-style selector.
3. Click `Carousel` and continue in carousel mode.
4. Fill the `Title` input with `Neighborhood Delegate Assembly`.
5. Enter a description in the rich-text editor.
6. Upload an event image.
7. Click `Next`.
8. Select the `Delegate assembly` event type.
9. Click `Next`.
10. Use the associated-group typeahead to select a managed group.
11. Click `Next`.
12. In delegate allocation, select `Total` mode.
13. Fill the `Total delegates` input.
14. Click `Next`.
15. Fill `Start date`.
16. Fill `Start time`.
17. Fill `End date`.
18. Fill `End time`.
19. Click `Next`.
20. Select the `Weekly` recurrence pattern.
21. Fill the `Interval` input.
22. Select at least one recurrence weekday.
23. Fill the recurrence `End date`.
24. Click `Next`.
25. Keep the `Physical` location tab selected.
26. Fill the `Venue name` input.
27. Fill the `Country` input.
28. Fill the `Region` input.
29. Fill the `City` input.
30. Fill the `Postal code` input.
31. Fill the `Street` input.
32. Fill the `House number` input.
33. Fill the `Capacity` input.
34. Click `Next`.
35. Fill the `Delegate nomination deadline` input.
36. Fill the `Amendment cutoff deadline` input.
37. Click `Next`.
38. Change visibility to `Authenticated`.
39. Add at least two hashtags.
40. Click `Next`.
41. Review the summary and click `Create`.

## ✅ Expected Assertions

1. One-page mode is available from the header selector.
2. Carousel mode shows step-by-step navigation with `Previous` and `Next`.
3. The `Title` input shows positive validation feedback.
4. The description editor keeps the entered text visible.
5. The uploaded image shows a preview or uploaded state.
6. The next carousel step is reachable.
7. The `Delegate assembly` event-type card remains highlighted.
8. The group-selection step is reachable.
9. The selected group appears as a chosen typeahead value/chip.
10. The next carousel step is reachable.
11. The delegate-allocation step is visible.
12. The `Total` allocation option remains highlighted.
13. The `Total delegates` input keeps the entered value.
14. The next carousel step is reachable.
15. The `Start date` input keeps the entered value.
16. The `Start time` input keeps the entered value.
17. The `End date` input keeps the entered value.
18. The `End time` input keeps the entered value.
19. The recurrence step is reachable.
20. The `Weekly` recurrence option remains highlighted.
21. The `Interval` input keeps the entered value.
22. The selected weekday stays visibly active.
23. The recurrence `End date` input keeps the entered value.
24. The location step is reachable.
25. The `Physical` tab remains selected.
26. The `Venue name` input keeps the entered value.
27. The `Country` input keeps the entered value.
28. The `Region` input keeps the entered value.
29. The `City` input keeps the entered value.
30. The `Postal code` input keeps the entered value.
31. The `Street` input keeps the entered value.
32. The `House number` input keeps the entered value.
33. The `Capacity` input keeps the entered value.
34. The deadlines step is reachable.
35. The `Delegate nomination deadline` input keeps the entered value.
36. The `Amendment cutoff deadline` input keeps the entered value.
37. The settings step is reachable.
38. The `Authenticated` visibility option remains selected/highlighted.
39. The hashtags appear as selected chips/tags.
40. The review step is reachable.
41. The review step shows the event type, selected group, dates, location, recurrence, deadlines, and visibility, and clicking `Create` redirects to the new event page.

## 🧩 Notes

Route: `/create/event`

Relevant files:

- `src/features/create/hooks/useCreateEventForm.tsx`
- `src/features/create/ui/inputs/EventTypeInput.tsx`
- `src/features/create/ui/inputs/DelegateAllocationInput.tsx`
- `src/features/create/ui/inputs/RecurringPatternInput.tsx`
- `src/features/create/ui/CreateFields.tsx`

### Execution Type

- [x] Automated
- [ ] Manual

### Viewports

- [ ] Mobile
- [ ] Tablet
- [x] Desktop
```

## 3. Amendment

Title: `🧪 - Create amendment in carousel mode with hierarchy target selection and path event feedback`

Body:

```md
### Description

Automated happy-path test for `/create/amendment` that verifies layout switching, then completes the amendment flow in carousel mode with a hierarchy-path target selection and positive feedback for each input.

## 📋 Prerequisites

1. An authenticated user can open `/create/amendment`.
2. Seed at least one reachable group/event path for the current user so the target selector has selectable groups and events.
3. Start with carousel mode active or switch to it during the test.

## 🔁 Steps / Scenario

1. Open `/create/amendment`.
2. Click `One page` in the form-style selector.
3. Click `Carousel` and continue in carousel mode.
4. Fill the `Title` input with `Membership Charter Update`.
5. Fill the optional `Subtitle` input.
6. Upload an amendment image.
7. Click `Next`.
8. In the target selector, keep `Hierarchy Path` selected.
9. Use `Select Target Group` to choose a reachable group.
10. Use `Select Target Event` to choose an event for that group.
11. If amendment path event selectors appear for additional groups, choose one event per group.
12. Click `Next`.
13. Change visibility to `Authenticated`.
14. Add at least two hashtags.
15. Click `Next`.
16. Review the summary and click `Create`.

## ✅ Expected Assertions

1. One-page mode is available from the header selector.
2. Carousel mode shows step-by-step navigation with `Previous` and `Next`.
3. The `Title` input shows positive validation feedback.
4. The `Subtitle` input keeps the entered value.
5. The uploaded image shows a preview or uploaded state.
6. The target-selection step is reachable.
7. The `Hierarchy Path` tab remains selected.
8. The selected target group appears as a chosen value in the group typeahead.
9. The selected target event appears as a chosen value in the event typeahead.
10. The target preview displays the selected target group and target event cards.
11. Each path-segment event selector shows its chosen event, and no path-validation error is shown.
12. The settings step is reachable.
13. The `Authenticated` visibility option remains selected/highlighted.
14. The hashtags appear as selected chips/tags.
15. The review step is reachable.
16. The review step shows the selected target group/event summary and visibility, and clicking `Create` redirects to the new amendment page.

## 🧩 Notes

Route: `/create/amendment`

Relevant files:

- `src/features/create/hooks/useCreateAmendmentForm.tsx`
- `src/features/amendments/ui/TargetGroupEventSelector.tsx`
- `src/features/create/ui/CreateFields.tsx`

### Execution Type

- [x] Automated
- [ ] Manual

### Viewports

- [ ] Mobile
- [ ] Tablet
- [x] Desktop
```

## 4. Blog

Title: `🧪 - Create blog entry in carousel mode with group attachment, cover image, visibility, and hashtags`

Body:

```md
### Description

Automated happy-path test for `/create/blog-entry` that verifies layout switching, then completes the blog-entry flow in carousel mode with per-input positive feedback.

## 📋 Prerequisites

1. An authenticated user can open `/create/blog-entry`.
2. Seed at least one group the user belongs to so the attach-to-group typeahead returns results.
3. Start with carousel mode active or switch to it during the test.

## 🔁 Steps / Scenario

1. Open `/create/blog-entry`.
2. Click `One page` in the form-style selector.
3. Click `Carousel` and continue in carousel mode.
4. Fill the `Title` input with `Neighborhood Assembly Notes`.
5. Fill the `Date` input.
6. Upload a cover image.
7. Use the `Attach to group` typeahead to select one of the user's groups.
8. Click `Next`.
9. Change visibility to `Authenticated`.
10. Add at least two hashtags.
11. Click `Next`.
12. Review the summary and click `Create`.

## ✅ Expected Assertions

1. One-page mode is available from the header selector.
2. Carousel mode shows step-by-step navigation with `Previous` and `Next`.
3. The `Title` input shows positive validation feedback.
4. The `Date` input keeps the entered value.
5. The uploaded image shows a preview or uploaded state.
6. The selected group appears as a chosen value/chip in the typeahead.
7. The settings step is reachable.
8. The `Authenticated` visibility option remains selected/highlighted.
9. The hashtags appear as selected chips/tags.
10. The review step is reachable.
11. The review step shows the date, selected group, and visibility, and clicking `Create` redirects to the new blog entry page.

## 🧩 Notes

Route: `/create/blog-entry`

Relevant files:

- `src/features/create/hooks/useCreateBlogForm.tsx`
- `src/features/create/ui/CreateFields.tsx`

### Execution Type

- [x] Automated
- [ ] Manual

### Viewports

- [ ] Mobile
- [ ] Tablet
- [x] Desktop
```

## 5. Payment

Title: `🧪 - Create income payment in carousel mode for a selected group with a selected user payer`

Body:

```md
### Description

Automated happy-path test for `/create/payment` that verifies layout switching, then creates an income payment in carousel mode with positive feedback for each input.

## 📋 Prerequisites

1. An authenticated user can open `/create/payment`.
2. Seed at least one selectable group and one selectable user.
3. Start with carousel mode active or switch to it during the test.

## 🔁 Steps / Scenario

1. Open `/create/payment`.
2. Click `One page` in the form-style selector.
3. Click `Carousel` and continue in carousel mode.
4. Use the `Group` typeahead to select a target group.
5. Click `Next`.
6. Keep the payment direction on `Income`.
7. Fill the `Label` input with `January membership fee`.
8. Open the payment-type select and choose a payment type, for example `Membership fee`.
9. Fill the `Amount` input with a positive decimal value.
10. Click `Next`.
11. Keep the entity toggle on `User`.
12. Use the user search input to select a payer.
13. Click `Next`.
14. Review the summary and click `Create`.

## ✅ Expected Assertions

1. One-page mode is available from the header selector.
2. Carousel mode shows step-by-step navigation with `Previous` and `Next`.
3. The selected group appears as a chosen value/chip in the typeahead.
4. The direction step is reachable.
5. The `Income` button remains selected and styled as the active option.
6. The `Label` input shows positive validation feedback.
7. The payment-type select shows the chosen option in its trigger.
8. The `Amount` input keeps the entered value.
9. The entity-selection step is reachable.
10. The `User` entity toggle remains selected/highlighted.
11. The selected user appears as a chosen chip/value in the search input.
12. The review step is reachable.
13. The review step shows the selected group, direction, type, and amount, and clicking `Create` redirects to the group page.

## 🧩 Notes

Route: `/create/payment`

Relevant files:

- `src/features/create/hooks/useCreatePaymentForm.tsx`
- `src/features/create/ui/inputs/DirectionInput.tsx`
- `src/features/create/ui/inputs/PaymentTypeInput.tsx`
- `src/features/create/ui/CreateFields.tsx`

### Execution Type

- [x] Automated
- [ ] Manual

### Viewports

- [ ] Mobile
- [ ] Tablet
- [x] Desktop
```

## 6. Statement

Title: `🧪 - Create statement in carousel mode with group attachment, media, survey options, hashtags, and visibility`

Body:

```md
### Description

Automated happy-path test for `/create/statement` that verifies layout switching, then completes the statement flow in carousel mode with positive feedback for each input.

## 📋 Prerequisites

1. An authenticated user can open `/create/statement`.
2. Seed at least one group the user is a member of so the attach-to-group filter returns a result.
3. Provide media fixtures for image and video uploads if the test will upload both.
4. Start with carousel mode active or switch to it during the test.

## 🔁 Steps / Scenario

1. Open `/create/statement`.
2. Click `One page` in the form-style selector.
3. Click `Carousel` and continue in carousel mode.
4. Fill the statement `Text` textarea with a short post.
5. Use the optional group typeahead to attach the statement to a group.
6. Click `Next`.
7. Upload an image.
8. Upload a video.
9. Fill the `Survey question` input.
10. Fill `Option 1`.
11. Fill `Option 2`.
12. Fill the `Duration (hours)` input.
13. Click `Next`.
14. Add at least two hashtags.
15. Click `Next`.
16. Change visibility to `Public`.
17. Click `Next`.
18. Review the summary and click `Create`.

## ✅ Expected Assertions

1. One-page mode is available from the header selector.
2. Carousel mode shows step-by-step navigation with `Previous` and `Next`.
3. The statement textarea shows positive feedback by keeping the content visible and the character counter stays in a non-error state.
4. The selected group appears as a chosen value/chip in the typeahead.
5. The media-and-survey step is reachable.
6. The uploaded image shows a preview or uploaded state.
7. The uploaded video shows a preview, file state, or uploaded state.
8. The `Survey question` input keeps the entered value.
9. `Option 1` keeps the entered value.
10. `Option 2` keeps the entered value.
11. The `Duration (hours)` input keeps the entered value.
12. The hashtag step is reachable.
13. The hashtags appear as selected chips/tags.
14. The visibility step is reachable.
15. The `Public` visibility option remains selected/highlighted.
16. The review step is reachable.
17. The review step shows the group, visibility, and survey summary, and clicking `Create` redirects to the new statement page.

## 🧩 Notes

Route: `/create/statement`

Relevant files:

- `src/features/create/hooks/useCreateStatementForm.tsx`
- `src/features/create/ui/CreateFields.tsx`

### Execution Type

- [x] Automated
- [ ] Manual

### Viewports

- [ ] Mobile
- [ ] Tablet
- [x] Desktop
```

## 7. Todo

Title: `🧪 - Create todo in carousel mode with assignee, due date, visibility, and tags`

Body:

```md
### Description

Automated happy-path test for `/create/todo` that verifies layout switching, then creates a personal todo in carousel mode with positive feedback for each input.

## 📋 Prerequisites

1. An authenticated user can open `/create/todo`.
2. Seed at least one selectable assignee for the user search input.
3. Start with carousel mode active or switch to it during the test.

## 🔁 Steps / Scenario

1. Open `/create/todo` without a locked `groupId` query parameter.
2. Click `One page` in the form-style selector.
3. Click `Carousel` and continue in carousel mode.
4. Fill the `Title` input with `Publish invite copy`.
5. Fill the `Description` textarea.
6. Click `Next`.
7. Select `High` priority.
8. Select `In progress` status.
9. Click `Next`.
10. Use the assignee search input to choose one user.
11. Click `Next`.
12. Fill the `Due date` input.
13. Set visibility to `Private`.
14. Add at least two tags.
15. Click `Next`.
16. Review the summary and click `Create`.

## ✅ Expected Assertions

1. One-page mode is available from the header selector.
2. Carousel mode shows step-by-step navigation with `Previous` and `Next`.
3. The `Title` input shows positive validation feedback.
4. The `Description` textarea keeps the entered text visible.
5. The priority/status step is reachable.
6. The `High` priority button remains selected/highlighted.
7. The `In progress` status button remains selected/highlighted.
8. The assignee step is reachable.
9. The selected assignee appears as a chosen chip/value in the search input.
10. The settings step is reachable.
11. The `Due date` input keeps the entered value.
12. The `Private` visibility option remains selected/highlighted.
13. The tags appear as selected chips/tags.
14. The review step is reachable.
15. The review step shows the selected priority, status, assignee summary, due date, visibility, and tags, and clicking `Create` redirects to `/todos`.

## 🧩 Notes

Route: `/create/todo`

Relevant files:

- `src/features/create/hooks/useCreateTodoForm.tsx`
- `src/features/create/ui/inputs/PriorityInput.tsx`
- `src/features/create/ui/inputs/StatusInput.tsx`

### Execution Type

- [x] Automated
- [ ] Manual

### Viewports

- [ ] Mobile
- [ ] Tablet
- [x] Desktop
```

## 8. Agenda item

Title: `🧪 - Create vote agenda item in carousel mode with voting settings and a linked amendment`

Body:

```md
### Description

Automated happy-path test for `/create/agenda-item` that verifies layout switching, then creates a vote agenda item in carousel mode with positive feedback for each input.

## 📋 Prerequisites

1. An authenticated user can open `/create/agenda-item`.
2. Seed at least one selectable event and one selectable amendment.
3. Start with carousel mode active or switch to it during the test.

## 🔁 Steps / Scenario

1. Open `/create/agenda-item`.
2. Click `One page` in the form-style selector.
3. Click `Carousel` and continue in carousel mode.
4. Use the event typeahead to select an event.
5. Fill the `Title` input with `Approve charter text`.
6. Fill the `Description` textarea.
7. Click `Next`.
8. In the type selector, choose `Vote`.
9. Fill the `Order` input.
10. Fill the `Duration` input.
11. Click `Next`.
12. Open the `Majority Type` select and choose an option.
13. Fill the `Time Limit (minutes)` input.
14. Click `Next`.
15. Use the amendment typeahead to select an amendment.
16. Click `Next`.
17. Review the summary and click `Create`.

## ✅ Expected Assertions

1. One-page mode is available from the header selector.
2. Carousel mode shows step-by-step navigation with `Previous` and `Next`.
3. The selected event appears as a chosen value/chip in the typeahead.
4. The `Title` input shows positive validation feedback.
5. The `Description` textarea keeps the entered text visible.
6. The type/settings step is reachable.
7. The `Vote` option remains selected/highlighted in the type selector.
8. The `Order` input keeps the entered value.
9. The `Duration` input keeps the entered value.
10. The voting-settings step is reachable.
11. The selected majority type is shown in the select trigger.
12. The `Time Limit` input keeps the entered value.
13. The additional-links step is reachable.
14. The selected amendment appears as a chosen value/chip in the typeahead.
15. The review step is reachable.
16. The review step shows the selected event, type, order, duration, amendment, majority type, and time limit, and clicking `Create` redirects to the event agenda page.

## 🧩 Notes

Route: `/create/agenda-item`

Relevant files:

- `src/features/create/hooks/useCreateAgendaItemForm.tsx`
- `src/features/create/ui/CreateFields.tsx`

### Execution Type

- [x] Automated
- [ ] Manual

### Viewports

- [ ] Mobile
- [ ] Tablet
- [x] Desktop
```

## 9. Election candidate

Title: `🧪 - Create election candidate in carousel mode with election lookup, statement, and image`

Body:

```md
### Description

Automated happy-path test for `/create/election-candidate` that verifies layout switching, then creates an election-candidate entry in carousel mode with positive feedback for each input.

## 📋 Prerequisites

1. An authenticated user can open `/create/election-candidate`.
2. Seed at least one selectable election.
3. Start with carousel mode active or switch to it during the test.

## 🔁 Steps / Scenario

1. Open `/create/election-candidate`.
2. Click `One page` in the form-style selector.
3. Click `Carousel` and continue in carousel mode.
4. Use the election search input to select an election.
5. Click `Next`.
6. Fill the candidate `Description` textarea with a short statement.
7. Upload a candidate image.
8. Click `Next`.
9. Review the summary and click `Create`.

## ✅ Expected Assertions

1. One-page mode is available from the header selector.
2. Carousel mode shows step-by-step navigation with `Previous` and `Next`.
3. The selected election appears as a chosen value/chip in the typeahead.
4. The description step is reachable.
5. The description textarea keeps the entered text visible.
6. The uploaded image shows a preview or uploaded state.
7. The review step is reachable.
8. The review step shows the candidate statement and image summary, a success toast appears after submission, and the flow redirects back to `/create`.

## 🧩 Notes

Route: `/create/election-candidate`

Relevant files:

- `src/features/create/hooks/useCreateElectionCandidateForm.tsx`
- `src/features/create/ui/inputs/ElectionSearchInput.tsx`

### Execution Type

- [x] Automated
- [ ] Manual

### Viewports

- [ ] Mobile
- [ ] Tablet
- [x] Desktop
```

## 10. Position

Title: `🧪 - Create position in carousel mode with group lookup, term length, and first-term start`

Body:

```md
### Description

Automated happy-path test for `/create/position` that verifies layout switching, then creates a position in carousel mode with positive feedback for each input.

## 📋 Prerequisites

1. An authenticated user can open `/create/position`.
2. Seed at least one selectable group.
3. Start with carousel mode active or switch to it during the test.

## 🔁 Steps / Scenario

1. Open `/create/position`.
2. Click `One page` in the form-style selector.
3. Click `Carousel` and continue in carousel mode.
4. Use the group typeahead to select a group.
5. Click `Next`.
6. Fill the `Title` input with `Treasurer`.
7. Fill the `Description` textarea.
8. Click `Next`.
9. Fill the `Term` input.
10. Fill the `First term start` input.
11. Click `Next`.
12. Review the summary and click `Create`.

## ✅ Expected Assertions

1. One-page mode is available from the header selector.
2. Carousel mode shows step-by-step navigation with `Previous` and `Next`.
3. The selected group appears as a chosen value/chip in the typeahead.
4. The title step is reachable.
5. The `Title` input shows positive validation feedback.
6. The `Description` textarea keeps the entered text visible.
7. The term step is reachable.
8. The `Term` input keeps the entered value.
9. The `First term start` input keeps the entered value.
10. The review step is reachable.
11. The review step shows the selected group, term length, and first-term start, and clicking `Create` redirects to the selected group page.

## 🧩 Notes

Route: `/create/position`

Relevant files:

- `src/features/create/hooks/useCreatePositionForm.tsx`
- `src/features/create/ui/CreateFields.tsx`

### Execution Type

- [x] Automated
- [ ] Manual

### Viewports

- [ ] Mobile
- [ ] Tablet
- [x] Desktop
```
