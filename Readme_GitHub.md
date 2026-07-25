# Git Workflow for My Fork

## One-time setup

```bash
git remote -v
git remote add upstream https://github.com/SnosMe/awakened-poe-trade.git
git remote -v
```

- `origin` = https://github.com/EntropyShadow/awakened-poe-trade
- `upstream` = https://github.com/SnosMe/awakened-poe-trade

Never push to `upstream`.

---

## Upload local changes to GitHub

1. Check changes

```bash
git status
```

2. Stage changes

```bash
git add .
```

3. Create a commit

```bash
git commit -m "Describe changes"
```

4. Push to GitHub

```bash
git push
```

First push only:

```bash
git push -u origin master
```

---

## Bring changes from upstream

Always start with a clean working tree:

```bash
git status
```

Then:

```bash
git fetch upstream
git merge upstream/master
git push
```

What each command does:

- `fetch` downloads commits from upstream but changes nothing locally.
- `merge` combines upstream changes into your local `master`.
- `push` uploads the merged result to your GitHub fork.

---

## Update another local clone

```bash
git pull
```

---

# Merge conflicts

A conflict happens when both you and upstream modified the same lines of a file.

During merge Git may stop with a message indicating conflicts.

## 1. See conflicting files

```bash
git status
```

Files marked as both modified contain conflicts.

## 2. Open each conflicting file

Git inserts markers like:

```text
< < < < < < < HEAD
your code
=======
upstream code
> > > > > > > upstream/master
```

Edit the file so it contains the final desired code.

Remove all conflict markers.

## 3. Mark conflict as resolved

```bash
git add <filename>
```

Repeat for every conflicted file.

## 4. Finish the merge

If Git did not automatically create the merge commit:

```bash
git commit
```

Git opens an editor with a default merge message. Save and close it.

## 5. Push

```bash
git push
```

---

## Abort a merge

If you decide not to continue:

```bash
git merge --abort
```

This restores the repository to the state before the merge started.

---

## Useful commands

Check status:

```bash
git status
```

View commit history:

```bash
git log --oneline --graph --decorate
```

See remotes:

```bash
git remote -v
```
