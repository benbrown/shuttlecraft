# SHUTTLECRAFT by the Confused Mavericks

This is a project to create an "easy" way to participate in the ActivityPub "Fediverse" and other indie web protocols like RSS.
This was created by [Ben Brown](https://benbrown.com) and enhanced by UCSD CSE 210 Team 6 (Confused Mavericks).

Currently, this means:

- a stand-alone NodeJS web application
- with no external service dependencies
- that is hostable on Glitch or commodity virtualhost

Including features:

- Create a fediverse account
- Follow people (on Mastodon, other instances)
- Customize your fediverse profile
- Compose posts and deliver on the web, and also via ActivityPub, RSS
- Fave, boost and reply to posts
- View notifications
- Send and receive DMs
- Block people or instances

Not yet supported:

- Media uploads

## Warning: Experimental Software!

This software should be considered an EXPERIMENTAL PROTOTYPE.
Do not use it to store or exchange sensitive information.

- This software creates publicly available web endpoints.
- This software sends outbound web requests.
- This software reads and writes to the filesystem!
- This software has not been audited for potential security problems!!

Because of the way the Mastodon works, once you start to engage with
users on other instances, you will start to receive traffic from a
wide array of other instances -- not all of which is necessary or
relevant to you. As a result, operating this software on a small basis
may result in unexpected amounts of incoming traffic.

## Warning: Known limitations!

Our goal with this app is to not use any major external services.
As a result, all data is written as PLAIN TEXT FILES to the disk.

Right now, the app builds an IN-MEMORY INDEX of EVERY SINGLE POST.
This will work for several thousand posts, but ... maybe not for 10,000s of posts.

ALSO, there is nothing fancy happening in terms of queuing or rate
limiting outgoing posts. When you post, it will send out HTTP requests
right away, all at once. This may cause issues.

## Bug Reports & Contributions

Please file bugs on Github:
https://github.com/benbrown/shuttlecraft/issues

Please read the [contributor's guide](CONTRIBUTING.md) before sending pull requests.

## Install

Quick start: [Remix on Glitch](https://glitch.com/edit/#!/import/github.com/CSE-210-Team-6/shuttlecraft)

- Remix the repo on glitch:
`https://github.com/CSE-210-Team-6/shuttlecraft.git`

- Go to settings -> Edit project details -> Change the project name to what you want. This will be your website domain

You are ready to run! But first, set your configuration.

## Config

Initial configuration of your instance is done by editing the
.env file to include your desired DOMAIN NAME.
These values MUST BE SET before you launch the application, as
they are used to generate your account details, including your
Fediverse actor ID.

In the .env file, put:

```
DOMAIN={your-project-name}.glitch.me
PORT={not required but can specify}
```

When you launch the app for the first time, these values will be used
to create the `.data/account.json` file which is the source of your
public account information, and will be used for many operations.

HOWEVER PLEASE NOTE that your ID is a real URL, and it must reflect
the real URL served by this app. Also note that it is embedded in
every post you write - so if you change values in the `account.json` file,
your previous posts may break.

## Access

Access your website at `https://yourdomain.com/private`. You will be prompted to create account or login if required.

## Debugging

If you want more logging or want to see what is happening in the background,
enable debugging by adding DEBUG=ono:\* to the .env file, or starting the app
with:

`DEBUG=ono:* npm start`

## Where is my data?

All of the data is stored in the `.data` folder in JSON files.

Incoming activities will be in `.data/activitystream`. Each incoming
post is in a dated folder, for example `2022/12-01/GUID.json`

Local posts are in `.data/posts`

Cached user information is in `.data/users`

Follower list, following list, like list, boost list, block list,
and notifications can all be found in their own files at the root
of the `.data` folder. This is your data! Back it up if you care
about it.

## Host

This is a node app that runs by default on port 3000, or the port
specified in the .env file.

In order to play nice with the fediverse, it must be hosted on an
SSL-enabled endpoint.

### Easiest: Glitch

Use Glitch to create a new project! Glitch will provide you with hosting for your instance of Shuttlecraft,
and you can start for FREE!

It all starts when you click this link -> [Remix this project on Glitch](https://glitch.com/edit/#!/import/github.com/CSE-210-Team-6/shuttlecraft) <--

WHOA! What happened? Well, a copy of the Shuttlecraft code was sent to a new, unique, owned-by-you web server and it started getting set up. You just need to make it yours by following these steps:

1. First, make sure the URL of your Glitch project is the one you like. You can change it in the "Settings" menu.
2. Then, configure the options [as described above](#config) using the .env editor.
3. Finally, login to the dashboard at `https://yourdomain.glitch.me/private`.
4. Done!

### Basic: Reverse proxy

1. Clone the repo to your own server.
2. Configure it and set it up to run on a port of your choosing.
3. Configure Caddy or Nginx with a Certbot SSL certificate.
4. Configure your domain to proxy requests to the localhost port.

A sample `Caddyfile` is included in the repo. [Install Caddy](https://caddyserver.com/download) and run:

```
caddy run --config Caddyfile
```

### Advanced: Docker

1. Clone the repo.
2. Build the image:
   ```
   docker build . --tag "${yourRegistryUsername}/shuttlecraft:latest"
   ```
3. Test locally:
   ```
   docker run -e PORT=3000 -e DOMAIN="your-domain.com" -p "3000:3000" "${yourRegistryUsername}/shuttlecraft"
   ```
4. Push the image to your registry:
   ```
   docker push "${yourRegistryUsername}/shuttlecraft:latest"
   ```
5. Deploy the image to your container platform with the required environment variables (`DOMAIN`).
6. Configure a web service to proxy requests to the container port and provide HTTPS (see "Reverse proxy" above).

## Customize

This app uses HandlebarsJS for templating.

Customize the public pages:

- Templates are in `design/public/home.handlebars` and `design/public/note.handlebars` and `design/layouts/public.handlebars`
- CSS is in `public/css/main.css`

Customize your avatar:

- Replace `public/images/avatar.png`
- As necessary, update the url in `.data/account.json` inside the actor.icon.url field

Customize the backend:

- Templates are in `design/dashboard.handlebars` and `design/notifications.handlebars` and `design/layouts/private.handlebars`
- Some common components in `design/partials`
- CSS in `public/css/secret.css`

To block users or instances:

- Add an entry to the file at `.data/blocks`
- You can block a user using their actor ID (something like https://foo.bar/@jerk) or their entire domain (https://foo.bar/)
- Restart the app
