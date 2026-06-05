# Roadmap & toDo

## ToDo

* [x] make tags deletable (via tag filter dropdown)
* [x] switch titles of columns from "Saturday (tomorrow)" to "Tomorrow (Saturday)". From definitive day names to relative (tomorrow, day after, in three days, etc)
* [x] find out why checking the checkbox of a repo does take several seconds instead of being instant. If possible change so that the UI immediately shows an action and then the action (select) is done. If required then deactivate the card until the action is done.
* [x] move to a dropdown for all individual columns instead of button "Move to Today" for selected repos. This would allow to move repos to any column, not just Today.
* [x] Switching between board and list view takes multiple seconds. Add an indicator that something is happening and try to optimize the switch.
* [x] clicking the "tag" button on an individual repo card opens the full menu for the repo and should show only the tag options.
* [x] add a sort option (dropdown) to individual columns. Add sort by name, stars, owner ASC and DESC.
* [x] make the day threshold configurable. The day threshold is the point where tomorrow becomes today. Currently we want this to be 4am. This should be configurable via an environment variable.
* [x] change the button for board/list view from a link to a button with an icon that changes to list when in board view and to board when in list view. no active/inactive state, just the button with icon.
* [x] add a select all button for each column and for the full list view to select all repos in the column/list. This would allow to do bulk actions on all repos in a column or in the full list.
* [x] in the top bar where showing the usernames/organisations that are included in the dashboard link the usernames/orgs to their github profile pages.
