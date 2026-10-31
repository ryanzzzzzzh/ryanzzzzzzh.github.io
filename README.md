# ispira. — GitHub Pages + Supabase

This is the deployable version of ryanzzzzzzh's personal blog. Visitors can read posts and submit comments. Only the configured owner account can publish or delete posts and upload attachments. New comments require approval.

## Set up Supabase

1. Create a Supabase project. In **Authentication → Sign In / Providers**, enable email sign-in. In **Authentication → Users**, choose **Add user → Send invitation** for your own email, complete the email invitation, then copy your user's UUID from the Users list. The site's magic-link sign-in does not create new users.
2. `schema.sql` and `config.js` are already set for the owner's UUID and this Supabase project. Run `schema.sql` once in Supabase's SQL Editor. Do not run it twice without reviewing the existing policies.
3. `config.js` contains only the public project URL, publishable key, and owner UUID. Never add a secret or service-role key to browser code.
4. In **Authentication → URL Configuration**, set your GitHub Pages URL as the site URL and add it to the allowed redirect URLs. For this account, it should be `https://ryanzzzzzzh.github.io/` if the repository is named `ryanzzzzzzh.github.io`.
5. In **Authentication → Settings**, disable public sign-ups after creating your owner user if the project is only for this blog. The database policies still enforce owner-only publishing if other accounts exist.

## Publish on GitHub Pages

Create a repository named `ryanzzzzzzh.github.io`, put `index.html`, `app.js`, and `config.js` at its root, and publish the default branch from **Settings → Pages**. `schema.sql` and this README can also stay in the repository. Supabase project settings must be filled in before the live site can load posts.

## Using the site

- Sign in through **Owner sign in**. Only the configured UUID gets the **Write a post** and **Delete story** controls. The same restriction is enforced in Supabase Row Level Security.
- The editor supports headings, lists, quotes, links, images by URL, text styles, and alignment. Attachments are limited to 10 MB each.
- Visitors can submit comments. They remain hidden until you approve them in the Supabase `comments` table by setting `approved` to `true`.
- The `post-attachments` storage bucket is public, so uploaded files can be downloaded by anyone with their URL. Do not upload private files.

## Current status

The Supabase project and GitHub repository exist. Database schema execution, GitHub Pages activation, and live authentication, database, upload, and deployment verification still need to be completed.

