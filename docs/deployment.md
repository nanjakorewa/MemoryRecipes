# GitHub Pages Deployment

This project ships with a GitHub Actions workflow that builds the Hugo site and publishes it to GitHub Pages.

## Prerequisites
- The repository must allow GitHub Actions to run.
- Pages should be configured to use the "GitHub Actions" build and deployment source.
- The default branch is assumed to be main; adjust the workflow trigger if you deploy from a different branch.

## Deployment Pipeline
1. The workflow checks out the repository (including Hugo modules).
2. It configures GitHub Pages and installs Hugo Extended v0.149.0.
3. The site is built with hugo --gc --minify --printI18nWarnings, using the Pages-provided URL as the base URL.
4. The generated public/ directory is uploaded as an artifact and deployed via ctions/deploy-pages@v4.

## Usage
- Push to main (or trigger the workflow manually) to build and deploy.
- Monitor the progress under the "Actions" tab; the Pages environment entry will link to the published site.

## Base URL Notes
The workflow overwrites Hugo's base URL during the build so local previews can keep using the development value in hugo.toml. If you need to hard-code a production URL, update the workflow's build step accordingly.
