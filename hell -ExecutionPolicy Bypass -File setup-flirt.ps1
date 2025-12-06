* [33m8106553[m[33m ([m[1;36mHEAD[m[33m -> [m[1;32mmain[m[33m)[m Add swap analysis docs and project1
*   [33m04c81c7[m Merge: cleanup documentation and scripts
[32m|[m[33m\[m  
[32m|[m * [33med4d378[m[33m ([m[1;31morigin/main[m[33m, [m[1;31morigin/HEAD[m[33m)[m Fix: use verifiedTasksRef to prevent state flickering for completed tasks
[32m|[m * [33m8944607[m Fix: stop verification for completed tasks and preserve their state
[32m|[m * [33m9ff6431[m Fix: auto-polling for opened tasks and preserve verified state
[32m|[m * [33ma7d7fd9[m Fix: preserve verified task state and reduce first polling delay to 7s
[32m|[m * [33m51d51c0[m Clean up: remove unused documentation, test files, and scripts
[32m|[m [33m|[m * [33mef982a7[m[33m ([m[1;35mrefs/stash[m[33m)[m WIP on main: 74c1762 Replace 'activity' with 'task' in user-facing UI text
[32m|[m [33m|[m[32m/[m[35m|[m 
[32m|[m[32m/[m[33m|[m [35m|[m 
[32m|[m [33m|[m * [33m216fbd5[m index on main: 74c1762 Replace 'activity' with 'task' in user-facing UI text
[32m|[m [33m|[m[32m/[m  
[32m|[m[32m/[m[33m|[m   
* [33m|[m [33m74c1762[m Replace 'activity' with 'task' in user-facing UI text
[33m|[m[33m/[m  
* [33me109fa2[m FIX: Improve userFid handling in generate-fortune API - check body, query and headers with detailed logging
* [33ma5de55f[m Fix: show green buttons for 2 seconds before redirect, no intermediate renders
* [33m4ba3ffd[m Fix: always call setTasks in handleVerifyAll so buttons turn green, then check for redirect
* [33m4393c5a[m Fix: update task state to completed in polling so button turns green after verification
* [33m7df7a0a[m CRITICAL: immediate redirect in polling and handleVerifyAll, check via API before any state updates
