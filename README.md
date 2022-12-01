# Ben's Single-user Social Instance

This is a project to create an "easy" way to participate in the ActivityPub "Fediverse" and other indie web protocols like RSS.

Currently, this means:

- a stand-alone NodeJS web application 
- with no external service dependencies
- that is hostable on Glitch or commodity virtualhost

Including features:
- Follow people (on Mastodon, other instances)
- Compose posts and deliver on the web, and also via ActivityPub, RSS
- Fave, boost and reply to posts
- View notifications
- Block people or instances

Not yet supported:
- DMs
- Incoming updates and deletes
- Media uploads
- Mentions
- Boost/like counts

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

My goal with this app is to not use any major external services.
As a result, all data is written as PLAIN TEXT FILES to the disk.

Right now, the app builds an IN-MEMORY INDEX of EVERY SINGLE POST.
This will work for several thousand posts, but ... maybe not for 10,000s of posts.
I'm not sure how far it will go. I have ideas about being able to
shard the index into multiple files and page through it, etc. But.

ALSO, there is nothing fancy happening in terms of queuing or rate
limiting outgoing posts. When you post, it will send out HTTP requests
right away, all at once. This may cause issues.

## Acknowledgements

This is mostly 

## Bug Reports

Please file bugs on Github:
https://github.com/benbrown/onosendai/issues

## Install

Clone the repo:
`git clone git@github.com:benbrown/onosendai.git`

Enter folder:
`cd onosendai`

Install node dependencies:
`npm install`

You are ready to run! But first, set your configuration.

When you are ready to start, run:
`npm start`

## Config

Initial configuration of your instance is done by editing the
.env file to include your desired USERNAME, PASSWORD, and DOMAIN NAME.
These values MUST BE SET before you launch the application, as
they are used to generate your account details, including your
Fediverse actor ID.

In the .env file, put:

```
USER=yourusername
PASS=yourpasswordforadmintools
DOMAIN=yourdomainname
PORT=3000
```

USER and PASS are required to login to the private dashboard tools.

When you launch the app for the first time, these values will be used
to create the `.data/account.json` file which is the source of your
public account information, and will be used for many operations.

There is currently no UI built to view or manage your account. If you
need to make updates, edit the JSON directly.

HOWEVER PLEASE NOTE that your ID is a real URL, and it must reflect
the real URL served by this app. Also note that it is embedded in
every post you write - so if you change values in the `account.json` file,
your previous posts may break.

## Debugging

If you want more logging or want to see what is happening in the background,
enable debugging by adding DEBUG=ono:* to the .env file, or starting the app
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

Use Glitch to create a new project.

Import the repo from Github.

Configure using their handy .env editor.

Done!

### Basic: nginx proxy

Clone the repo to your own server.

Configure it and set it up to run on a port of your choosing.

Configure nginx with a certbot ssl certificate.

Configure your domain to proxy requests to the localhost port.

## Login

To login, visit `https://yourdomain.com/private` and provide the username and password from your .env file


## Customize

This app uses HandlebarsJS for templating.

Customize the public pages:
- Templates are in `design/home.handlebars` and `design/note.handlebars` and `design/layouts/public.handlebars`
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